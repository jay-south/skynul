use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Json, Router};
use futures::{SinkExt, StreamExt};
use serde::Deserialize;
use tokio::sync::broadcast::error::RecvError;

use crate::agent::spawn_task_pipeline;
use crate::api::state::AppState;
use crate::api::tasks_util::{project_map, task_to_response};
use crate::api::types::{
    OkResponse, TaskCancelResponse, TaskContinueRequest, TaskCreatedResponse, TaskCreateRequest,
    TaskListResponse, TaskResponse, TaskStreamEvent, ToolApprovalRequest,
};
use crate::db::get_conn;
use crate::error::AppError;
use crate::models::task::NewTask;
use crate::policy::parse_create_mode;
use crate::repo;

const DEFAULT_MAX_STEPS: i64 = 200;
const DEFAULT_TIMEOUT_MS: i64 = 30 * 60 * 1000;
const DEFAULT_LIST_LIMIT: i64 = 20;
const MAX_LIST_LIMIT: i64 = 100;
const DESKTOP_SOURCE: &str = "desktop";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ListTasksQuery {
    limit: Option<i64>,
    offset: Option<i64>,
    project_id: Option<String>,
}

async fn list_tasks(
    State(state): State<AppState>,
    Query(query): Query<ListTasksQuery>,
) -> Result<Json<TaskListResponse>, AppError> {
    let limit = query.limit.unwrap_or(DEFAULT_LIST_LIMIT).clamp(1, MAX_LIST_LIMIT);
    let offset = query.offset.unwrap_or(0).max(0);
    let project_id = query.project_id.as_deref();

    let mut conn = get_conn(&state.pool)?;
    let total = repo::task::count(&mut conn, project_id)?;
    let tasks = repo::task::list_paginated(&mut conn, limit, offset, project_id)?;
    let projects = project_map(&mut conn);
    let items = tasks
        .iter()
        .map(|task| task_to_response(task, projects.get(&task.id).cloned()))
        .collect();

    Ok(Json(TaskListResponse { items, total }))
}

async fn get_task(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<TaskResponse>, AppError> {
    let mut conn = get_conn(&state.pool)?;
    let task = repo::task::get(&mut conn, &id)?;
    let projects = project_map(&mut conn);
    Ok(Json(task_to_response(
        &task,
        projects.get(&task.id).cloned(),
    )))
}

async fn create_task(
    State(state): State<AppState>,
    Json(body): Json<TaskCreateRequest>,
) -> Result<(StatusCode, Json<TaskCreatedResponse>), AppError> {
    let mut conn = get_conn(&state.pool)?;
    let now = chrono::Utc::now().timestamp_millis();
    let (initial_mode, mode_source) = parse_create_mode(body.mode.as_deref());
    let messages = repo::task::initial_messages_json(&body.prompt, now);

    let new_task = NewTask {
        id: uuid::Uuid::new_v4().to_string(),
        prompt: body.prompt,
        attachments: body
            .attachments
            .map(|a| serde_json::to_string(&a).unwrap_or_default()),
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
        source: Some(DESKTOP_SOURCE.to_string()),
        source_chat_id: None,
        mode_reasoning: None,
        mode_source: mode_source.to_string(),
        messages,
    };
    let task = repo::task::create(&mut conn, new_task)?;
    let task_id = task.id.clone();

    tracing::info!(
        task_id = %task_id,
        mode_source = %mode_source,
        prompt_len = task.prompt.len(),
        "task created"
    );

    state.task_streams.emit_status(&task_id, "running");
    spawn_task_pipeline(state.clone(), task_id.clone());

    Ok((
        StatusCode::CREATED,
        Json(TaskCreatedResponse {
            id: task_id,
            status: "running".to_string(),
        }),
    ))
}

async fn continue_task(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<TaskContinueRequest>,
) -> Result<(StatusCode, Json<TaskCreatedResponse>), AppError> {
    let mut conn = get_conn(&state.pool)?;
    let task = repo::task::append_user_message(&mut conn, &id, &body.prompt)?;
    let task_id = task.id.clone();

    tracing::info!(
        task_id = %task_id,
        prompt_len = body.prompt.len(),
        "task continued"
    );

    state.task_streams.emit_status(&task_id, "running");
    spawn_task_pipeline(state.clone(), task_id.clone());

    Ok((
        StatusCode::OK,
        Json(TaskCreatedResponse {
            id: task_id,
            status: "running".to_string(),
        }),
    ))
}

async fn cancel_task(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<TaskCancelResponse>, AppError> {
    let mut conn = get_conn(&state.pool)?;
    let task = repo::task::cancel(&mut conn, &id)?;
    drop(conn);
    state.task_streams.emit_terminal(&task);
    state.channels.relay_task_update(&task.id).await;
    Ok(Json(TaskCancelResponse {
        id: task.id,
        status: "cancelled".to_string(),
    }))
}

async fn approve_tool(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<ToolApprovalRequest>,
) -> Result<Json<OkResponse>, AppError> {
    {
        let mut conn = get_conn(&state.pool)?;
        repo::task::get(&mut conn, &id)?;
    }
    if !state
        .tool_approvals
        .respond(&body.request_id, body.approved)
    {
        return Err(AppError::NotFound("approval request not found or expired".into()));
    }
    Ok(Json(OkResponse { ok: true }))
}

async fn delete_task(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<OkResponse>, AppError> {
    let mut conn = get_conn(&state.pool)?;
    repo::task::delete(&mut conn, &id)?;
    Ok(Json(OkResponse { ok: true }))
}

async fn stream_task(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    {
        let mut conn = get_conn(&state.pool)?;
        repo::task::get(&mut conn, &id)?;
    }

    Ok(ws.on_upgrade(move |socket| handle_task_stream(socket, state, id)))
}

async fn handle_task_stream(socket: WebSocket, state: AppState, task_id: String) {
    let (mut sender, mut receiver) = socket.split();
    let mut rx = state.task_streams.subscribe(&task_id);

    if let Ok(mut conn) = get_conn(&state.pool) {
        if let Ok(task) = repo::task::get(&mut conn, &task_id) {
            let initial = TaskStreamEvent::StatusChange {
                status: task.status,
            };
            if let Ok(json) = serde_json::to_string(&initial) {
                let _ = sender.send(Message::Text(json.into())).await;
            }
        }
    }

    loop {
        tokio::select! {
            incoming = receiver.next() => {
                match incoming {
                    Some(Ok(Message::Close(_))) | None => break,
                    Some(Ok(_)) => {}
                    Some(Err(_)) => break,
                }
            }
            event = rx.recv() => {
                match event {
                    Ok(json) => {
                        let is_done = json.contains("\"done\"");
                        if sender.send(Message::Text(json.into())).await.is_err() {
                            break;
                        }
                        if is_done {
                            break;
                        }
                    }
                    Err(RecvError::Lagged(_)) => continue,
                    Err(_) => break,
                }
            }
        }
    }
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/tasks", get(list_tasks).post(create_task))
        .route("/tasks/{id}", get(get_task).delete(delete_task))
        .route("/tasks/{id}/messages", post(continue_task))
        .route("/tasks/{id}/cancel", post(cancel_task))
        .route("/tasks/{id}/tool-approval", post(approve_tool))
        .route("/tasks/{id}/stream", get(stream_task))
}
