use diesel::prelude::*;

use crate::db::DbConn;
use crate::error::AppError;
use crate::models::task::{NewTask, Task};
use crate::schema::tasks::dsl::*;

pub fn create(conn: &mut DbConn, new_task: NewTask) -> Result<Task, AppError> {
    diesel::insert_into(tasks)
        .values(&new_task)
        .returning(Task::as_returning())
        .get_result(conn)
        .map_err(AppError::from)
}

pub fn get(conn: &mut DbConn, task_id: &str) -> Result<Task, AppError> {
    tasks
        .filter(id.eq(task_id))
        .first(conn)
        .map_err(|e| match e {
            diesel::NotFound => AppError::NotFound(format!("task {task_id} not found")),
            other => AppError::Database(other),
        })
}

pub fn list(conn: &mut DbConn) -> Result<Vec<Task>, AppError> {
    tasks
        .order(created_at.desc())
        .load::<Task>(conn)
        .map_err(AppError::from)
}

pub fn approve(conn: &mut DbConn, task_id: &str) -> Result<Task, AppError> {
    let now = chrono::Utc::now().timestamp_millis();
    let updated = diesel::update(tasks.filter(id.eq(task_id)).filter(status.eq("pending")))
        .set((status.eq("running"), updated_at.eq(now)))
        .returning(Task::as_returning())
        .get_result(conn)?;

    Ok(updated)
}

pub fn cancel(conn: &mut DbConn, task_id: &str) -> Result<Task, AppError> {
    let now = chrono::Utc::now().timestamp_millis();
    diesel::update(
        tasks
            .filter(id.eq(task_id))
            .filter(status.eq_any(vec!["pending", "running"])),
    )
    .set((status.eq("cancelled"), updated_at.eq(now)))
    .returning(Task::as_returning())
    .get_result(conn)
    .map_err(|e| match e {
        diesel::NotFound => AppError::NotFound(format!("task {task_id} not found")),
        other => AppError::Database(other),
    })
}

pub fn delete(conn: &mut DbConn, task_id: &str) -> Result<(), AppError> {
    diesel::delete(tasks.filter(id.eq(task_id)))
        .execute(conn)?;
    Ok(())
}

pub fn apply_sidecar_update(
    conn: &mut DbConn,
    task_id: &str,
    new_status: &str,
    step: Option<serde_json::Value>,
    new_summary: Option<String>,
    new_error: Option<String>,
) -> Result<Task, AppError> {
    let now = chrono::Utc::now().timestamp_millis();
    let existing = get(conn, task_id)?;

    let new_steps = match step {
        Some(s) => {
            let mut arr: Vec<serde_json::Value> =
                serde_json::from_str(&existing.steps).unwrap_or_default();
            arr.push(s);
            serde_json::to_string(&arr).unwrap_or_else(|_| "[]".to_string())
        }
        None => existing.steps,
    };

    diesel::update(tasks.filter(id.eq(task_id)))
        .set((
            status.eq(new_status),
            steps.eq(&new_steps),
            summary.eq(new_summary.as_deref()),
            error.eq(new_error.as_deref()),
            updated_at.eq(now),
        ))
        .returning(Task::as_returning())
        .get_result(conn)
        .map_err(AppError::from)
}
