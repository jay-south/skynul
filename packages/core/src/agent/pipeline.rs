use std::sync::Arc;

use crate::api::AppState;
use crate::channels::ChannelRuntime;
use crate::db::DbPool;
use crate::models::policy::PolicyRecord;
use crate::policy::{ModeSource, TaskMode};
use crate::repo;
use crate::secrets::SecretsStore;

use super::conversational;
use super::harness::{self, HarnessDeps};

fn has_prior_assistant_turn(task: &crate::models::task::Task) -> bool {
    repo::task::bootstrap_thread(task)
        .iter()
        .any(|m| m.get("role").and_then(|v| v.as_str()) == Some("assistant"))
}

fn has_action_intent(lower: &str) -> bool {
    const HINTS: &[&str] = &[
        "listame",
        "listá",
        "lista ",
        "mostrá",
        "muestra",
        "decime qué archivos",
        "qué archivos",
        "archivos tengo",
        "ejecut",
        "corré",
        "corre ",
        "grep",
        "find",
        "edit",
        "leé",
        "lee ",
        "read ",
        "escrib",
        "write",
        "copi",
        "copia",
        "mové",
        "mueve",
        "borrá",
        "borra",
        "delete",
        "find ",
        "busca",
        "abrí",
        "abre ",
        "open ",
        "ls ",
        "cat ",
        "head ",
        "tail ",
        "mkdir",
        "chmod",
    ];
    HINTS.iter().any(|h| lower.contains(h))
}

fn is_closing_or_summary(lower: &str) -> bool {
    lower.contains("resum")
        || lower.contains("summar")
        || lower.contains("quedamos")
        || lower.contains("en 2 oraciones")
        || lower.contains("en dos oraciones")
        || lower.starts_with("perfecto")
        || lower.starts_with("genial")
        || lower.starts_with("excelente")
        || lower.starts_with("listo")
        || lower.starts_with("dale")
        || lower.starts_with("bueno,")
        || lower.starts_with("ok,")
        || lower.starts_with("okay,")
}

fn is_conversational_greeting(lower: &str) -> bool {
    const GREETINGS: &[&str] = &[
        "hola", "hi", "hello", "hey", "buenas", "gracias", "thanks", "help", "ayuda",
    ];
    GREETINGS.iter().any(|g| {
        lower == *g || lower.starts_with(&format!("{g} ")) || lower.starts_with(&format!("{g},"))
    })
}

fn resolve_mode(task: &crate::models::task::Task) -> TaskMode {
    if task.mode_source == ModeSource::Manual.as_str() && !task.mode.is_empty() {
        return TaskMode::parse(&task.mode).unwrap_or(TaskMode::Agent);
    }
    let latest = repo::task::latest_user_content(task);
    let text = latest.trim();
    if text.is_empty() {
        return TaskMode::Conversational;
    }
    let lower = text.to_lowercase();

    if has_action_intent(&lower) {
        return TaskMode::Agent;
    }
    if is_conversational_greeting(&lower) || is_closing_or_summary(&lower) {
        return TaskMode::Conversational;
    }
    if has_prior_assistant_turn(task) {
        return TaskMode::Conversational;
    }
    TaskMode::Agent
}

async fn finish_task(
    pool: &DbPool,
    streams: &crate::api::TaskStreamHub,
    channels: Option<&Arc<ChannelRuntime>>,
    task_id: &str,
) {
    let task = match get_conn(pool).and_then(|mut c| repo::task::get(&mut c, task_id)) {
        Ok(t) => t,
        Err(e) => {
            tracing::error!(task_id = %task_id, error = %e, "pipeline: finish get task failed");
            return;
        }
    };
    streams.emit_terminal(&task);
    if let Some(ch) = channels {
        ch.relay_task_update(task_id).await;
    }
}

fn get_conn(pool: &DbPool) -> Result<crate::db::DbConn, crate::error::AppError> {
    crate::db::get_conn(pool)
}

async fn run_conversational_task(
    pool: &DbPool,
    task_id: &str,
    task: &crate::models::task::Task,
    policy: &PolicyRecord,
    secrets: &SecretsStore,
    streams: &crate::api::TaskStreamHub,
) {
    match conversational::respond_with_history(task, policy, secrets, |chunk| {
        streams.emit_delta(task_id, chunk);
    })
    .await
    {
        Ok(text) => {
            if let Ok(mut conn) = get_conn(pool) {
                let _ = repo::task::finalize_turn(
                    &mut conn,
                    task_id,
                    "completed",
                    Some(text),
                    None,
                );
            }
        }
        Err(msg) => {
            if let Ok(mut conn) = get_conn(pool) {
                let _ = repo::task::fail_task(&mut conn, task_id, &msg);
            }
        }
    }
}

pub async fn run_task_pipeline(state: AppState, task_id: String) {
    let pool = state.pool.clone();
    let channels = Some(state.channels.clone());
    let secrets = state.secrets.clone();
    let streams = state.task_streams.clone();
    let tool_approvals = state.tool_approvals.clone();

    tracing::info!(task_id = %task_id, "pipeline: start");

    let (task, policy) = {
        let mut conn = match get_conn(&pool) {
            Ok(c) => c,
            Err(e) => {
                tracing::error!(task_id = %task_id, error = %e, "pipeline: db conn failed");
                return;
            }
        };
        let task = match repo::task::get(&mut conn, &task_id) {
            Ok(t) => t,
            Err(e) => {
                tracing::error!(task_id = %task_id, error = %e, "pipeline: get task failed");
                return;
            }
        };
        let policy = match repo::policy::get(&mut conn) {
            Ok(p) => p,
            Err(e) => {
                tracing::error!(task_id = %task_id, error = %e, "pipeline: get policy failed");
                return;
            }
        };
        (task, policy)
    };

    let mode = resolve_mode(&task);
    if let Ok(mut conn) = get_conn(&pool) {
        let source = ModeSource::parse(&task.mode_source).unwrap_or(ModeSource::Inferred);
        let _ = repo::task::set_mode(
            &mut conn,
            &task_id,
            mode.as_str(),
            source.as_str(),
        );
    }

    let running_task = {
        let mut conn = match get_conn(&pool) {
            Ok(c) => c,
            Err(e) => {
                tracing::error!(task_id = %task_id, error = %e, "pipeline: running db failed");
                return;
            }
        };
        match repo::task::set_status(&mut conn, &task_id, "running") {
            Ok(t) => t,
            Err(e) => {
                tracing::error!(task_id = %task_id, error = %e, "pipeline: set running failed");
                return;
            }
        }
    };

    streams.emit_status(&task_id, "running");
    tracing::info!(task_id = %task_id, mode = %mode.as_str(), "pipeline: running");

    match mode {
        TaskMode::Conversational => {
            run_conversational_task(
                &pool,
                &task_id,
                &running_task,
                &policy,
                &secrets,
                &streams,
            )
            .await;
        }
        TaskMode::Agent => {
            let deps = HarnessDeps {
                pool: pool.clone(),
                policy: policy.clone(),
                secrets: secrets.clone(),
                streams: streams.clone(),
                tool_approvals: tool_approvals.clone(),
                task_id: task_id.clone(),
            };
            if let Err(e) = harness::run(running_task, deps).await {
                tracing::error!(task_id = %task_id, error = %e, "pipeline: harness failed");
                if let Ok(mut conn) = get_conn(&pool) {
                    let _ = repo::task::fail_task(&mut conn, &task_id, &e);
                }
            }
        }
    }

    finish_task(&pool, &streams, channels.as_ref(), &task_id).await;
}

pub fn spawn_task_pipeline(state: AppState, task_id: String) {
    tokio::spawn(async move {
        run_task_pipeline(state, task_id).await;
    });
}
