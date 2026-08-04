use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::routing::{delete, get, put};
use axum::{Json, Router};
use serde::Deserialize;

use crate::api::dto::schedule_response;
use crate::api::state::AppState;
use crate::api::types::{Schedule, ScheduleListResponse};
use crate::db::get_conn;
use crate::error::AppError;
use crate::models::schedule::NewSchedule;
use crate::repo;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateScheduleBody {
    prompt: String,
    frequency: String,
    cron_expr: String,
    enabled: Option<bool>,
}

fn map_schedules(schedules: Vec<crate::models::schedule::Schedule>) -> Vec<Schedule> {
    schedules.iter().map(schedule_response).collect()
}

async fn list_schedules(
    State(state): State<AppState>,
) -> Result<Json<ScheduleListResponse>, AppError> {
    let mut conn = get_conn(&state.pool)?;
    let schedules = repo::schedule::list(&mut conn)?;
    Ok(Json(ScheduleListResponse {
        schedules: map_schedules(schedules),
    }))
}

async fn create_schedule(
    State(state): State<AppState>,
    Json(body): Json<CreateScheduleBody>,
) -> Result<(StatusCode, Json<ScheduleListResponse>), AppError> {
    let mut conn = get_conn(&state.pool)?;
    let now = chrono::Utc::now().timestamp_millis();
    let new = NewSchedule {
        id: uuid::Uuid::new_v4().to_string(),
        prompt: body.prompt,
        capabilities: "[]".to_string(),
        mode: "agent".to_string(),
        frequency: body.frequency,
        cron_expr: body.cron_expr,
        enabled: body.enabled.unwrap_or(true),
        last_run_at: None,
        next_run_at: now,
        created_at: now,
    };
    let schedules = repo::schedule::create(&mut conn, new)?;
    Ok((
        StatusCode::CREATED,
        Json(ScheduleListResponse {
            schedules: map_schedules(schedules),
        }),
    ))
}

async fn toggle_schedule(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ScheduleListResponse>, AppError> {
    let mut conn = get_conn(&state.pool)?;
    let schedules = repo::schedule::toggle(&mut conn, &id)?;
    Ok(Json(ScheduleListResponse {
        schedules: map_schedules(schedules),
    }))
}

async fn delete_schedule(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ScheduleListResponse>, AppError> {
    let mut conn = get_conn(&state.pool)?;
    let schedules = repo::schedule::delete(&mut conn, &id)?;
    Ok(Json(ScheduleListResponse {
        schedules: map_schedules(schedules),
    }))
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/schedules", get(list_schedules).post(create_schedule))
        .route("/schedules/{id}/toggle", put(toggle_schedule))
        .route("/schedules/{id}", delete(delete_schedule))
}
