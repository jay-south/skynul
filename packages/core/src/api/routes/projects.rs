use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::routing::{get, patch, post};
use axum::{Json, Router};

use crate::api::dto::{project_response, project_summary};
use crate::api::state::AppState;
use crate::api::types::{AddTaskToProjectRequest, CreateProjectRequest, OkResponse, PatchProjectRequest, Project, ProjectSummary};
use crate::db::get_conn;
use crate::error::AppError;
use crate::models::project::NewProject;
use crate::repo;

async fn list_projects(
    State(state): State<AppState>,
) -> Result<Json<Vec<ProjectSummary>>, AppError> {
    let mut conn = get_conn(&state.pool)?;
    let projects = repo::project::list(&mut conn)?;
    Ok(Json(
        projects.iter().map(project_summary).collect(),
    ))
}

async fn create_project(
    State(state): State<AppState>,
    Json(body): Json<CreateProjectRequest>,
) -> Result<(StatusCode, Json<Project>), AppError> {
    let mut conn = get_conn(&state.pool)?;
    let now = chrono::Utc::now().timestamp_millis();
    let new = NewProject {
        id: uuid::Uuid::new_v4().to_string(),
        name: body.name,
        color: body.color.unwrap_or_else(|| "#6366f1".to_string()),
        created_at: now,
        task_ids: "[]".to_string(),
    };
    let project = repo::project::create(&mut conn, new)?;
    Ok((StatusCode::CREATED, Json(project_response(&project))))
}

async fn patch_project(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<PatchProjectRequest>,
) -> Result<Json<Project>, AppError> {
    if body.name.is_none() && body.color.is_none() {
        return Err(AppError::BadRequest("no fields to update".into()));
    }
    let mut conn = get_conn(&state.pool)?;
    let project = repo::project::patch(
        &mut conn,
        &id,
        body.name.as_deref(),
        body.color.as_deref(),
    )?;
    Ok(Json(project_response(&project)))
}

async fn add_task_to_project(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<AddTaskToProjectRequest>,
) -> Result<Json<OkResponse>, AppError> {
    let mut conn = get_conn(&state.pool)?;
    repo::project::add_task(&mut conn, &id, &body.task_id)?;
    Ok(Json(OkResponse { ok: true }))
}

async fn delete_project(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    let mut conn = get_conn(&state.pool)?;
    repo::project::delete(&mut conn, &id)?;
    Ok(StatusCode::NO_CONTENT)
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/projects", get(list_projects).post(create_project))
        .route(
            "/projects/{id}",
            patch(patch_project).delete(delete_project),
        )
        .route("/projects/{id}/tasks", post(add_task_to_project))
}
