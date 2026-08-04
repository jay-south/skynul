use std::collections::HashMap;
use std::sync::Arc;

use tokio::sync::Mutex;
use tokio::task::JoinHandle;

use crate::agent::spawn_task_pipeline;
use crate::api::AppState;
use crate::api::TaskStreamHub;
use crate::api::ToolApprovalHub;
use crate::db::{get_conn, DbPool};
use crate::models::task::NewTask;
use crate::policy::parse_create_mode;
use crate::repo;
use crate::secrets::SecretsStore;

use super::telegram;

const DEFAULT_MAX_STEPS: i64 = 200;
const DEFAULT_TIMEOUT_MS: i64 = 30 * 60 * 1000;

pub struct ChannelRuntime {
    pub(crate) pool: DbPool,
    secrets: Arc<SecretsStore>,
    task_streams: Arc<TaskStreamHub>,
    tool_approvals: Arc<ToolApprovalHub>,
    workers: Mutex<HashMap<String, JoinHandle<()>>>,
}

impl ChannelRuntime {
    pub fn new(
        pool: DbPool,
        secrets: Arc<SecretsStore>,
        task_streams: Arc<TaskStreamHub>,
        tool_approvals: Arc<ToolApprovalHub>,
    ) -> Arc<Self> {
        Arc::new(Self {
            pool,
            secrets,
            task_streams,
            tool_approvals,
            workers: Mutex::new(HashMap::new()),
        })
    }

    pub async fn start(self: &Arc<Self>) {
        let channels = match get_conn(&self.pool).and_then(|mut c| repo::channel::list(&mut c)) {
            Ok(ch) => ch,
            Err(e) => {
                tracing::error!("channels: list failed: {e}");
                return;
            }
        };

        for channel in channels {
            if channel.enabled && channel.has_credentials {
                self.ensure_worker(&channel.id).await;
            }
        }
    }

    pub async fn reload(self: &Arc<Self>, channel_id: &str) {
        self.stop_worker(channel_id).await;
        let channel = match get_conn(&self.pool).and_then(|mut c| repo::channel::get(&mut c, channel_id))
        {
            Ok(ch) => ch,
            Err(e) => {
                tracing::error!(channel_id = %channel_id, error = %e, "channels: reload get failed");
                return;
            }
        };
        if channel.enabled && channel.has_credentials {
            self.ensure_worker(channel_id).await;
        }
    }

    pub async fn notify(&self, source: &str, chat_id: i64, text: &str) {
        if source == "telegram" {
            telegram::send_message(&self.pool, chat_id, text).await;
        } else {
            tracing::warn!(source = %source, "channels: notify not implemented");
        }
    }

    pub async fn relay_task_update(self: &Arc<Self>, task_id: &str) {
        let task = match get_conn(&self.pool).and_then(|mut c| repo::task::get(&mut c, task_id)) {
            Ok(t) => t,
            Err(e) => {
                tracing::error!(task_id = %task_id, error = %e, "channels: relay get task failed");
                return;
            }
        };

        let (Some(source), Some(chat_id)) = (task.source.as_deref(), task.source_chat_id) else {
            return;
        };
        if source == "desktop" {
            return;
        }

        let text = match task.status.as_str() {
            "completed" => task.summary.clone().unwrap_or_else(|| "✅ Tarea completada.".into()),
            "failed" => format!(
                "❌ Tarea fallida: {}",
                task.error.as_deref().unwrap_or("error desconocido")
            ),
            "cancelled" => "⛔ Tarea cancelada.".into(),
            _ => return,
        };

        self.notify(source, chat_id, &text).await;
    }

    pub fn spawn_task_from_message(self: &Arc<Self>, source: String, chat_id: i64, text: String) {
        let state = AppState {
            pool: self.pool.clone(),
            channels: self.clone(),
            secrets: self.secrets.clone(),
            task_streams: self.task_streams.clone(),
            tool_approvals: self.tool_approvals.clone(),
        };

        tokio::spawn(async move {
            let task_id = match create_channel_task(&state.pool, &source, chat_id, &text) {
                Some(id) => id,
                None => return,
            };
            spawn_task_pipeline(state, task_id);
        });
    }

    async fn ensure_worker(self: &Arc<Self>, channel_id: &str) {
        let mut workers = self.workers.lock().await;
        if workers.contains_key(channel_id) {
            return;
        }

        let handle = match channel_id {
            "telegram" => telegram::spawn(self.clone()),
            other => {
                tracing::info!(channel_id = %other, "channels: worker not implemented");
                return;
            }
        };

        workers.insert(channel_id.to_string(), handle);
    }

    async fn stop_worker(&self, channel_id: &str) {
        let mut workers = self.workers.lock().await;
        if let Some(handle) = workers.remove(channel_id) {
            handle.abort();
        }
        let _ = get_conn(&self.pool).and_then(|mut c| {
            repo::channel::set_status(&mut c, channel_id, "disconnected", None)
        });
    }
}

fn create_channel_task(pool: &DbPool, source: &str, chat_id: i64, text: &str) -> Option<String> {
    let mut conn = get_conn(pool).ok()?;
    let now = chrono::Utc::now().timestamp_millis();
    let (initial_mode, mode_source) = parse_create_mode(None);
    let messages = repo::task::initial_messages_json(text, now);
    let new_task = NewTask {
        id: uuid::Uuid::new_v4().to_string(),
        prompt: text.to_string(),
        attachments: None,
        status: "running".to_string(),
        mode: initial_mode,
        capabilities: "[]".to_string(),
        steps: "[]".to_string(),
        usage: None,
        created_at: now,
        updated_at: now,
        max_steps: DEFAULT_MAX_STEPS,
        timeout_ms: DEFAULT_TIMEOUT_MS,
        error: None,
        summary: None,
        source: Some(source.to_string()),
        source_chat_id: Some(chat_id),
        mode_reasoning: None,
        mode_source: mode_source.to_string(),
        messages,
    };
    match repo::task::create(&mut conn, new_task) {
        Ok(t) => Some(t.id),
        Err(e) => {
            tracing::error!("channels: create task failed: {e}");
            None
        }
    }
}

pub async fn spawn_runtime(
    pool: DbPool,
    secrets: Arc<SecretsStore>,
    task_streams: Arc<TaskStreamHub>,
    tool_approvals: Arc<ToolApprovalHub>,
) -> Arc<ChannelRuntime> {
    let runtime = ChannelRuntime::new(pool, secrets, task_streams, tool_approvals);
    runtime.start().await;
    runtime
}
