use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use axum::extract::Path;
use axum::extract::State;
use axum::response::IntoResponse;
use axum::routing::{delete, get, post, put};
use axum::{Json, Router};
use serde::Deserialize;
use skynul_core::db::{establish_pool, DbPool};
use skynul_core::error::AppError;
use skynul_core::models::policy::PolicyRecord;
use skynul_core::models::task::{NewTask, Task};
use skynul_core::models::project::NewProject;
use skynul_core::models::schedule::NewSchedule;
use skynul_core::protocol::{
    self, ChannelInit, InitConfig, ProviderConfig, SidecarHandle, SidecarInput, SidecarOutput,
    TaskInput,
};
use skynul_core::repo::{self, channel::ChannelGlobal};
use tokio::io::AsyncBufReadExt;
use tower_http::cors::{Any, CorsLayer};

// ── App State ────────────────────────────────────────────────────────────────

#[derive(Clone)]
struct AppState {
    pool: DbPool,
    sidecar: Option<Arc<SidecarHandle>>,
}

// ── Request Bodies ───────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct CreateTaskBody {
    prompt: String,
    capabilities: Vec<String>,
    attachments: Option<Vec<String>>,
    mode: Option<String>,
    max_steps: Option<i64>,
    timeout_ms: Option<i64>,
    source: Option<String>,
}

#[derive(Deserialize)]
struct SendMessageBody {
    message: String,
}

#[derive(Deserialize)]
struct SetLanguageBody {
    language: String,
}

#[derive(Deserialize)]
struct SetThemeBody {
    theme_mode: String,
}

#[derive(Deserialize)]
struct SetCapabilityBody {
    id: String,
    enabled: bool,
}

#[derive(Deserialize)]
struct SetProviderBody {
    provider_id: String,
}

#[derive(Deserialize)]
struct SetProviderModelBody {
    model: String,
}

#[derive(Deserialize)]
struct CreateScheduleBody {
    prompt: String,
    frequency: String,
    cron_expr: String,
    enabled: Option<bool>,
}

#[derive(Deserialize)]
struct CreateProjectBody {
    name: String,
}

#[derive(Deserialize)]
struct AddTaskToProjectBody {
    task_id: String,
}

#[derive(Deserialize)]
struct SetEnabledBody {
    enabled: bool,
}

// ── Response Wrappers ────────────────────────────────────────────────────────

#[derive(serde::Serialize)]
struct TaskResponse {
    task: serde_json::Value,
}

#[derive(serde::Serialize)]
struct TaskListResponse {
    tasks: Vec<serde_json::Value>,
}

#[derive(serde::Serialize)]
struct ScheduleListResponse {
    schedules: Vec<serde_json::Value>,
}

#[derive(serde::Serialize)]
struct ChannelListResponse {
    channels: Vec<serde_json::Value>,
}

#[derive(serde::Serialize)]
struct OkResponse {
    ok: bool,
}

#[derive(serde::Serialize)]
struct CodeResponse {
    code: String,
}

// ── Sidecar Helpers ──────────────────────────────────────────────────────────

fn api_key_for(provider_id: &str) -> Option<String> {
    let env_var = match provider_id {
        "openai" => "OPENAI_API_KEY",
        "anthropic" => "ANTHROPIC_API_KEY",
        "google" | "gemini" => "GOOGLE_API_KEY",
        "kimi" => "KIMI_API_KEY",
        "glm" => "GLM_API_KEY",
        "deepseek" => "DEEPSEEK_API_KEY",
        "minimax" => "MINIMAX_API_KEY",
        "openrouter" => "OPENROUTER_API_KEY",
        _ => return None,
    };
    std::env::var(env_var).ok()
}

async fn trigger_execute(task: &Task, policy: &PolicyRecord, sidecar: &SidecarHandle) {
    let capabilities: Vec<String> =
        serde_json::from_str(&task.capabilities).unwrap_or_default();
    let attachments: Option<Vec<String>> = task
        .attachments
        .as_deref()
        .and_then(|s| serde_json::from_str(s).ok());

    let task_input = TaskInput {
        id: task.id.clone(),
        prompt: task.prompt.clone(),
        attachments,
        mode: task.mode.clone(),
        capabilities,
        max_steps: task.max_steps,
        timeout_ms: task.timeout_ms,
        source: task.source.clone(),
    };

    let provider = ProviderConfig {
        id: policy.provider_active.clone(),
        model: policy
            .provider_model
            .clone()
            .unwrap_or_else(|| "gpt-4o".to_string()),
        api_key: api_key_for(&policy.provider_active),
    };

    if let Err(e) = sidecar
        .send(&SidecarInput::Execute {
            task: task_input,
            provider,
        })
        .await
    {
        tracing::error!("sidecar execute: {e}");
    }
}

// ── Sidecar Output Handler ───────────────────────────────────────────────────

async fn handle_sidecar_output(output: SidecarOutput, pool: &DbPool, sidecar: &SidecarHandle) {
    match output {
        SidecarOutput::Ready => {}
        SidecarOutput::Error { message } => {
            tracing::error!("sidecar error: {message}");
        }
        SidecarOutput::TaskUpdate {
            task_id,
            status,
            message,
            step,
            summary,
        } => {
            let task_error = if status == "failed" || status == "error" {
                message
            } else {
                None
            };

            match skynul_core::db::get_conn(pool) {
                Ok(mut conn) => {
                    if let Err(e) = repo::task::apply_sidecar_update(
                        &mut conn,
                        &task_id,
                        &status,
                        step,
                        summary,
                        task_error,
                    ) {
                        tracing::error!("update task {task_id}: {e}");
                    }
                }
                Err(e) => tracing::error!("db conn for task update: {e}"),
            }
        }
        SidecarOutput::ChannelIncoming {
            source,
            chat_id,
            text,
        } => {
            handle_channel_incoming(source, chat_id, text, pool, sidecar).await;
        }
    }
}

async fn handle_channel_incoming(
    source: String,
    _chat_id: String,
    text: String,
    pool: &DbPool,
    sidecar: &SidecarHandle,
) {
    let (task, policy) = {
        let mut conn = match skynul_core::db::get_conn(pool) {
            Ok(c) => c,
            Err(e) => {
                tracing::error!("db conn for channel_incoming: {e}");
                return;
            }
        };

        let policy = match repo::policy::get(&mut conn) {
            Ok(p) => p,
            Err(e) => {
                tracing::error!("get policy for channel_incoming: {e}");
                return;
            }
        };

        let now = chrono::Utc::now().timestamp_millis();
        let new_task = NewTask {
            id: uuid::Uuid::new_v4().to_string(),
            prompt: text.clone(),
            attachments: None,
            status: "running".to_string(),
            mode: "browser".to_string(),
            capabilities: policy.capabilities.clone(),
            steps: "[]".to_string(),
            usage: None,
            created_at: now,
            updated_at: now,
            max_steps: 200,
            timeout_ms: 30 * 60 * 1000,
            error: None,
            summary: None,
            source: Some(source.clone()),
        };

        match repo::task::create(&mut conn, new_task) {
            Ok(t) => (t, policy),
            Err(e) => {
                tracing::error!("create task from channel: {e}");
                return;
            }
        }
    };

    trigger_execute(&task, &policy, sidecar).await;
}

// ── Sidecar Startup ──────────────────────────────────────────────────────────

async fn build_init_config(pool: &DbPool) -> InitConfig {
    let mut conn = match skynul_core::db::get_conn(pool) {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("db conn for init config: {e}");
            return InitConfig::default();
        }
    };

    let channels = match repo::channel::list(&mut conn) {
        Ok(ch) => ch,
        Err(e) => {
            tracing::error!("list channels for init: {e}");
            return InitConfig::default();
        }
    };

    let map: HashMap<String, ChannelInit> = channels
        .into_iter()
        .filter(|c| c.enabled && c.has_credentials)
        .map(|c| {
            let credentials: HashMap<String, String> =
                serde_json::from_str(&c.meta).unwrap_or_default();
            (c.id, ChannelInit { enabled: true, credentials })
        })
        .collect();

    InitConfig {
        channels: if map.is_empty() { None } else { Some(map) },
    }
}

async fn spawn_and_wire_sidecar(pool: &DbPool) -> Result<SidecarHandle, std::io::Error> {
    let cmd_str = std::env::var("SKYNUL_SIDECAR_CMD")
        .unwrap_or_else(|_| "tsx ../server/src/index.ts".to_string());

    let parts: Vec<&str> = cmd_str.split_whitespace().collect();
    let (cmd, args) = parts
        .split_first()
        .expect("SKYNUL_SIDECAR_CMD cannot be empty");

    tracing::info!("spawning sidecar: {cmd} {}", args.join(" "));

    let spawned = protocol::spawn_sidecar(cmd, args).await?;
    let handle = spawned.handle.clone();

    let (ready_tx, ready_rx) = tokio::sync::oneshot::channel::<()>();

    let pool_reader = pool.clone();
    let handle_reader = handle.clone();

    tokio::spawn(async move {
        let _child = spawned.child;
        let mut reader = tokio::io::BufReader::new(spawned.stdout).lines();
        let mut ready_opt = Some(ready_tx);

        while let Ok(Some(line)) = reader.next_line().await {
            match serde_json::from_str::<SidecarOutput>(&line) {
                Ok(SidecarOutput::Ready) => {
                    if let Some(tx) = ready_opt.take() {
                        let _ = tx.send(());
                    }
                }
                Ok(other) => {
                    handle_sidecar_output(other, &pool_reader, &handle_reader).await;
                }
                Err(e) => {
                    tracing::warn!("sidecar parse error: {e} — line: {}", &line[..line.len().min(200)]);
                }
            }
        }

        tracing::warn!("sidecar stdout closed");
    });

    match tokio::time::timeout(Duration::from_secs(15), ready_rx).await {
        Ok(Ok(())) => tracing::info!("sidecar ready"),
        Ok(Err(_)) => tracing::warn!("sidecar ready channel dropped"),
        Err(_) => tracing::warn!("sidecar ready timeout — continuing anyway"),
    }

    let init_config = build_init_config(pool).await;
    if let Err(e) = handle
        .send(&SidecarInput::Init { config: init_config })
        .await
    {
        tracing::error!("send init to sidecar: {e}");
    }

    Ok(handle)
}

// ── Health ───────────────────────────────────────────────────────────────────

async fn ping() -> impl IntoResponse {
    "ok"
}

// ── Task Handlers ────────────────────────────────────────────────────────────

async fn list_tasks(State(state): State<AppState>) -> Result<Json<TaskListResponse>, AppError> {
    let mut conn = skynul_core::db::get_conn(&state.pool)?;
    let tasks = repo::task::list(&mut conn)?;
    let tasks: Vec<serde_json::Value> = tasks
        .into_iter()
        .map(|t| serde_json::to_value(t).unwrap_or_default())
        .collect();
    Ok(Json(TaskListResponse { tasks }))
}

async fn get_task(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<TaskResponse>, AppError> {
    let mut conn = skynul_core::db::get_conn(&state.pool)?;
    let task = repo::task::get(&mut conn, &id)?;
    let task = serde_json::to_value(task).unwrap_or_default();
    Ok(Json(TaskResponse { task }))
}

async fn create_task(
    State(state): State<AppState>,
    Json(body): Json<CreateTaskBody>,
) -> Result<Json<TaskResponse>, AppError> {
    let (task, policy_opt) = {
        let mut conn = skynul_core::db::get_conn(&state.pool)?;
        let now = chrono::Utc::now().timestamp_millis();

        let policy = repo::policy::get(&mut conn).ok();
        let auto_approve = policy.as_ref().map(|p| p.task_auto_approve).unwrap_or(false);

        let new_task = NewTask {
            id: uuid::Uuid::new_v4().to_string(),
            prompt: body.prompt,
            attachments: body
                .attachments
                .map(|a| serde_json::to_string(&a).unwrap_or_default()),
            status: if auto_approve {
                "running".to_string()
            } else {
                "pending".to_string()
            },
            mode: body.mode.unwrap_or_else(|| "browser".to_string()),
            capabilities: serde_json::to_string(&body.capabilities).unwrap_or_default(),
            steps: "[]".to_string(),
            usage: None,
            created_at: now,
            updated_at: now,
            max_steps: body.max_steps.unwrap_or(200),
            timeout_ms: body.timeout_ms.unwrap_or(30 * 60 * 1000),
            error: None,
            summary: None,
            source: body.source,
        };
        let task = repo::task::create(&mut conn, new_task)?;
        (task, policy)
    };

    if let (Some(sidecar), Some(policy)) = (&state.sidecar, &policy_opt) {
        if policy.task_auto_approve {
            trigger_execute(&task, policy, sidecar).await;
        }
    }

    let task_val = serde_json::to_value(&task).unwrap_or_default();
    Ok(Json(TaskResponse { task: task_val }))
}

async fn approve_task(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<TaskResponse>, AppError> {
    let (task, policy_opt) = {
        let mut conn = skynul_core::db::get_conn(&state.pool)?;
        let task = repo::task::approve(&mut conn, &id)?;
        let policy = repo::policy::get(&mut conn).ok();
        (task, policy)
    };

    if let (Some(sidecar), Some(policy)) = (&state.sidecar, &policy_opt) {
        trigger_execute(&task, policy, sidecar).await;
    }

    let task_val = serde_json::to_value(&task).unwrap_or_default();
    Ok(Json(TaskResponse { task: task_val }))
}

async fn cancel_task(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<TaskResponse>, AppError> {
    let mut conn = skynul_core::db::get_conn(&state.pool)?;
    let task = repo::task::cancel(&mut conn, &id)?;
    drop(conn);

    if let Some(sidecar) = &state.sidecar {
        if let Err(e) = sidecar
            .send(&SidecarInput::Cancel {
                task_id: task.id.clone(),
            })
            .await
        {
            tracing::error!("sidecar cancel: {e}");
        }
    }

    let task_val = serde_json::to_value(&task).unwrap_or_default();
    Ok(Json(TaskResponse { task: task_val }))
}

async fn delete_task(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<OkResponse>, AppError> {
    let mut conn = skynul_core::db::get_conn(&state.pool)?;
    repo::task::delete(&mut conn, &id)?;
    Ok(Json(OkResponse { ok: true }))
}

async fn send_message(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<SendMessageBody>,
) -> Result<Json<OkResponse>, AppError> {
    if let Some(sidecar) = &state.sidecar {
        sidecar
            .send(&SidecarInput::Message {
                task_id: id,
                message: body.message,
            })
            .await?;
    }
    Ok(Json(OkResponse { ok: true }))
}

// ── Policy Handlers ──────────────────────────────────────────────────────────

async fn get_policy(State(state): State<AppState>) -> Result<Json<serde_json::Value>, AppError> {
    let mut conn = skynul_core::db::get_conn(&state.pool)?;
    let record = repo::policy::get(&mut conn)?;
    policy_to_json(record)
}

async fn set_language(
    State(state): State<AppState>,
    Json(body): Json<SetLanguageBody>,
) -> Result<Json<serde_json::Value>, AppError> {
    let mut conn = skynul_core::db::get_conn(&state.pool)?;
    let record = repo::policy::update_language(&mut conn, &body.language)?;
    policy_to_json(record)
}

async fn set_theme(
    State(state): State<AppState>,
    Json(body): Json<SetThemeBody>,
) -> Result<Json<serde_json::Value>, AppError> {
    let mut conn = skynul_core::db::get_conn(&state.pool)?;
    let record = repo::policy::update_theme_mode(&mut conn, &body.theme_mode)?;
    policy_to_json(record)
}

async fn set_capability(
    State(state): State<AppState>,
    Json(body): Json<SetCapabilityBody>,
) -> Result<Json<serde_json::Value>, AppError> {
    let mut conn = skynul_core::db::get_conn(&state.pool)?;
    let record = repo::policy::get(&mut conn)?;
    let mut caps: serde_json::Map<String, serde_json::Value> =
        serde_json::from_str(&record.capabilities).unwrap_or(serde_json::Map::new());
    caps.insert(body.id, serde_json::Value::Bool(body.enabled));
    let caps_json = serde_json::to_string(&caps).unwrap_or_default();
    let record = repo::policy::update_capabilities(&mut conn, &caps_json)?;
    policy_to_json(record)
}

async fn set_auto_approve(
    State(state): State<AppState>,
    Json(body): Json<SetEnabledBody>,
) -> Result<Json<serde_json::Value>, AppError> {
    let mut conn = skynul_core::db::get_conn(&state.pool)?;
    let record = repo::policy::update_auto_approve(&mut conn, body.enabled)?;
    policy_to_json(record)
}

async fn set_provider(
    State(state): State<AppState>,
    Json(body): Json<SetProviderBody>,
) -> Result<Json<serde_json::Value>, AppError> {
    let mut conn = skynul_core::db::get_conn(&state.pool)?;
    let record = repo::policy::update_provider(&mut conn, &body.provider_id, None)?;
    policy_to_json(record)
}

async fn set_provider_model(
    State(state): State<AppState>,
    Json(body): Json<SetProviderModelBody>,
) -> Result<Json<serde_json::Value>, AppError> {
    let mut conn = skynul_core::db::get_conn(&state.pool)?;
    let record = repo::policy::update_provider_model(&mut conn, &body.model)?;
    policy_to_json(record)
}

async fn set_workspace(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    let mut conn = skynul_core::db::get_conn(&state.pool)?;
    let record = repo::policy::get(&mut conn)?;
    policy_to_json(record)
}

fn policy_to_json(
    record: skynul_core::models::policy::PolicyRecord,
) -> Result<Json<serde_json::Value>, AppError> {
    let capabilities: serde_json::Value =
        serde_json::from_str(&record.capabilities).unwrap_or_default();
    let policy = serde_json::json!({
        "workspaceRoot": record.workspace_root,
        "capabilities": capabilities,
        "themeMode": record.theme_mode,
        "language": record.language,
        "provider": {
            "active": record.provider_active,
            "model": record.provider_model
        },
        "taskAutoApprove": record.task_auto_approve,
    });
    Ok(Json(policy))
}

// ── Schedule Handlers ────────────────────────────────────────────────────────

async fn list_schedules(
    State(state): State<AppState>,
) -> Result<Json<ScheduleListResponse>, AppError> {
    let mut conn = skynul_core::db::get_conn(&state.pool)?;
    let schedules = repo::schedule::list(&mut conn)?;
    let schedules: Vec<serde_json::Value> = schedules
        .into_iter()
        .map(|s| serde_json::to_value(s).unwrap_or_default())
        .collect();
    Ok(Json(ScheduleListResponse { schedules }))
}

async fn create_schedule(
    State(state): State<AppState>,
    Json(body): Json<CreateScheduleBody>,
) -> Result<Json<ScheduleListResponse>, AppError> {
    let mut conn = skynul_core::db::get_conn(&state.pool)?;
    let now = chrono::Utc::now().timestamp_millis();
    let new = NewSchedule {
        id: uuid::Uuid::new_v4().to_string(),
        prompt: body.prompt,
        capabilities: "[]".to_string(),
        mode: "browser".to_string(),
        frequency: body.frequency,
        cron_expr: body.cron_expr,
        enabled: body.enabled.unwrap_or(true),
        last_run_at: None,
        next_run_at: now,
        created_at: now,
    };
    let schedules = repo::schedule::create(&mut conn, new)?;
    let schedules: Vec<serde_json::Value> = schedules
        .into_iter()
        .map(|s| serde_json::to_value(s).unwrap_or_default())
        .collect();
    Ok(Json(ScheduleListResponse { schedules }))
}

async fn toggle_schedule(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ScheduleListResponse>, AppError> {
    let mut conn = skynul_core::db::get_conn(&state.pool)?;
    let schedules = repo::schedule::toggle(&mut conn, &id)?;
    let schedules: Vec<serde_json::Value> = schedules
        .into_iter()
        .map(|s| serde_json::to_value(s).unwrap_or_default())
        .collect();
    Ok(Json(ScheduleListResponse { schedules }))
}

async fn delete_schedule(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ScheduleListResponse>, AppError> {
    let mut conn = skynul_core::db::get_conn(&state.pool)?;
    let schedules = repo::schedule::delete(&mut conn, &id)?;
    let schedules: Vec<serde_json::Value> = schedules
        .into_iter()
        .map(|s| serde_json::to_value(s).unwrap_or_default())
        .collect();
    Ok(Json(ScheduleListResponse { schedules }))
}

// ── Project Handlers ─────────────────────────────────────────────────────────

async fn list_projects(
    State(state): State<AppState>,
) -> Result<Json<Vec<serde_json::Value>>, AppError> {
    let mut conn = skynul_core::db::get_conn(&state.pool)?;
    let projects = repo::project::list(&mut conn)?;
    let projects: Vec<serde_json::Value> = projects
        .into_iter()
        .map(|p| {
            let task_ids: Vec<String> = serde_json::from_str(&p.task_ids).unwrap_or_default();
            serde_json::json!({
                "id": p.id,
                "name": p.name,
                "color": p.color,
                "createdAt": p.created_at,
                "taskIds": task_ids,
            })
        })
        .collect();
    Ok(Json(projects))
}

async fn create_project(
    State(state): State<AppState>,
    Json(body): Json<CreateProjectBody>,
) -> Result<Json<serde_json::Value>, AppError> {
    let mut conn = skynul_core::db::get_conn(&state.pool)?;
    let now = chrono::Utc::now().timestamp_millis();
    let new = NewProject {
        id: uuid::Uuid::new_v4().to_string(),
        name: body.name,
        color: "#6366f1".to_string(),
        created_at: now,
        task_ids: "[]".to_string(),
    };
    let project = repo::project::create(&mut conn, new)?;
    let result = serde_json::json!({
        "id": project.id,
        "name": project.name,
        "color": project.color,
        "createdAt": project.created_at,
        "taskIds": Vec::<String>::new(),
    });
    Ok(Json(result))
}

async fn add_task_to_project(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<AddTaskToProjectBody>,
) -> Result<Json<OkResponse>, AppError> {
    let mut conn = skynul_core::db::get_conn(&state.pool)?;
    repo::project::add_task(&mut conn, &id, &body.task_id)?;
    Ok(Json(OkResponse { ok: true }))
}

async fn delete_project(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<OkResponse>, AppError> {
    let mut conn = skynul_core::db::get_conn(&state.pool)?;
    repo::project::delete(&mut conn, &id)?;
    Ok(Json(OkResponse { ok: true }))
}

// ── Channel Handlers ─────────────────────────────────────────────────────────

async fn list_channels(
    State(state): State<AppState>,
) -> Result<Json<ChannelListResponse>, AppError> {
    let mut conn = skynul_core::db::get_conn(&state.pool)?;
    let channels = repo::channel::list(&mut conn)?;
    let channels: Vec<serde_json::Value> = channels
        .into_iter()
        .map(|c| {
            let meta: serde_json::Value = serde_json::from_str(&c.meta).unwrap_or_default();
            serde_json::json!({
                "id": c.id,
                "enabled": c.enabled,
                "status": c.status,
                "paired": c.paired,
                "pairingCode": c.pairing_code,
                "error": c.error,
                "hasCredentials": c.has_credentials,
                "meta": meta,
            })
        })
        .collect();
    Ok(Json(ChannelListResponse { channels }))
}

async fn get_channel_global(
    State(state): State<AppState>,
) -> Result<Json<ChannelGlobal>, AppError> {
    let mut conn = skynul_core::db::get_conn(&state.pool)?;
    let global = repo::channel::get_global(&mut conn)?;
    Ok(Json(global))
}

async fn set_channel_enabled(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<SetEnabledBody>,
) -> Result<Json<serde_json::Value>, AppError> {
    let mut conn = skynul_core::db::get_conn(&state.pool)?;
    let channel = repo::channel::update_enabled(&mut conn, &id, body.enabled)?;
    let meta: serde_json::Value = serde_json::from_str(&channel.meta).unwrap_or_default();
    let result = serde_json::json!({
        "id": channel.id,
        "enabled": channel.enabled,
        "status": channel.status,
        "paired": channel.paired,
        "pairingCode": channel.pairing_code,
        "error": channel.error,
        "hasCredentials": channel.has_credentials,
        "meta": meta,
    });
    Ok(Json(result))
}

async fn set_channel_credentials(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(creds): Json<serde_json::Map<String, serde_json::Value>>,
) -> Result<Json<OkResponse>, AppError> {
    let mut conn = skynul_core::db::get_conn(&state.pool)?;
    let meta = serde_json::to_string(&creds).unwrap_or_default();
    repo::channel::update_credentials(&mut conn, &id, &meta)?;
    Ok(Json(OkResponse { ok: true }))
}

async fn generate_channel_pairing(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<CodeResponse>, AppError> {
    let mut conn = skynul_core::db::get_conn(&state.pool)?;
    let code = repo::channel::generate_pairing(&mut conn, &id)?;
    Ok(Json(CodeResponse { code }))
}

async fn unpair_channel(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<OkResponse>, AppError> {
    let mut conn = skynul_core::db::get_conn(&state.pool)?;
    repo::channel::unpair(&mut conn, &id)?;
    Ok(Json(OkResponse { ok: true }))
}

async fn set_channel_auto_approve(
    State(state): State<AppState>,
    Json(body): Json<SetEnabledBody>,
) -> Result<Json<ChannelGlobal>, AppError> {
    let mut conn = skynul_core::db::get_conn(&state.pool)?;
    let global = repo::channel::update_auto_approve(&mut conn, body.enabled)?;
    Ok(Json(global))
}

// ── Runtime Handler ──────────────────────────────────────────────────────────

async fn get_runtime_stats() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "app": {
            "cpuPercent": 0.0,
            "memoryMB": 0.0,
        },
        "system": {
            "freeMemMB": 0.0,
        },
    }))
}

// ── Main ─────────────────────────────────────────────────────────────────────

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_target(false)
        .with_level(true)
        .init();

    let db_path = std::env::var("SKYNUL_DB_PATH").ok();
    let pool = establish_pool(db_path.as_deref()).expect("failed to init database");

    let sidecar = if std::env::var("SKYNUL_SIDECAR_DISABLED").is_err() {
        match spawn_and_wire_sidecar(&pool).await {
            Ok(handle) => {
                tracing::info!("sidecar wired");
                Some(Arc::new(handle))
            }
            Err(e) => {
                tracing::error!("sidecar spawn failed: {e} — running without sidecar");
                None
            }
        }
    } else {
        tracing::info!("sidecar disabled");
        None
    };

    let state = AppState { pool, sidecar };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/ping", get(ping))
        .route("/api/tasks", get(list_tasks).post(create_task))
        .route("/api/tasks/{id}", get(get_task).delete(delete_task))
        .route("/api/tasks/{id}/approve", post(approve_task))
        .route("/api/tasks/{id}/cancel", post(cancel_task))
        .route("/api/tasks/{id}/message", post(send_message))
        .route("/api/policy", get(get_policy))
        .route("/api/policy/language", post(set_language))
        .route("/api/policy/theme", post(set_theme))
        .route("/api/policy/capability", post(set_capability))
        .route("/api/policy/auto-approve", post(set_auto_approve))
        .route("/api/policy/provider", post(set_provider))
        .route("/api/policy/provider/model", put(set_provider_model))
        .route("/api/policy/workspace", post(set_workspace))
        .route("/api/schedules", get(list_schedules).post(create_schedule))
        .route("/api/schedules/{id}/toggle", put(toggle_schedule))
        .route("/api/schedules/{id}", delete(delete_schedule))
        .route("/api/projects", get(list_projects).post(create_project))
        .route("/api/projects/{id}/tasks", post(add_task_to_project))
        .route("/api/projects/{id}", delete(delete_project))
        .route("/api/channels", get(list_channels))
        .route("/api/channels/global", get(get_channel_global))
        .route("/api/channels/{id}/enabled", put(set_channel_enabled))
        .route("/api/channels/{id}/credentials", put(set_channel_credentials))
        .route(
            "/api/channels/{id}/pairing",
            post(generate_channel_pairing).delete(unpair_channel),
        )
        .route("/api/channels/auto-approve", put(set_channel_auto_approve))
        .route("/api/runtime/stats", get(get_runtime_stats))
        .layer(cors)
        .with_state(state);

    let port = std::env::var("SKYNUL_PORT").unwrap_or_else(|_| "3141".to_string());
    let addr = format!("0.0.0.0:{port}");
    tracing::info!("skynul-server listening on http://{addr}");

    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .expect("failed to bind address");
    axum::serve(listener, app).await.expect("server failed");
}
