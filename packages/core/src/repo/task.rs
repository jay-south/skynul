use diesel::prelude::*;
use serde_json::json;

use crate::db::DbConn;
use crate::error::AppError;
use crate::models::task::{NewTask, Task};
use crate::schema::tasks::dsl::{self, tasks as tasks_table};

pub fn initial_messages_json(content: &str, ts: i64) -> String {
    serde_json::to_string(&vec![json!({
        "role": "user",
        "content": content,
        "createdAt": ts
    })])
    .unwrap_or_else(|_| "[]".to_string())
}

pub fn can_continue(task_status: &str) -> bool {
    matches!(task_status, "completed" | "failed" | "cancelled")
}

pub fn latest_user_content(task: &Task) -> String {
    parse_message_values(&task.messages)
        .into_iter()
        .rev()
        .find(|m| m.get("role").and_then(|v| v.as_str()) == Some("user"))
        .and_then(|m| m.get("content").and_then(|v| v.as_str()).map(str::to_string))
        .unwrap_or_else(|| task.prompt.clone())
}

fn parse_message_values(raw: &str) -> Vec<serde_json::Value> {
    serde_json::from_str(raw).unwrap_or_default()
}

pub fn bootstrap_thread(task: &Task) -> Vec<serde_json::Value> {
    let mut thread = parse_message_values(&task.messages);
    if !thread.is_empty() {
        return thread;
    }

    thread.push(json!({
        "role": "user",
        "content": task.prompt,
        "createdAt": task.created_at
    }));

    if let Some(summary) = task.summary.as_ref().filter(|s| !s.trim().is_empty()) {
        let mut assistant = json!({
            "role": "assistant",
            "content": summary,
            "createdAt": task.updated_at
        });
        let turn_steps = steps_from_raw(&task.steps);
        if !turn_steps.is_empty() {
            assistant["steps"] = json!(turn_steps);
        }
        thread.push(assistant);
    } else if let Some(err) = task.error.as_ref().filter(|s| !s.trim().is_empty()) {
        thread.push(json!({
            "role": "assistant",
            "content": err,
            "createdAt": task.updated_at,
            "error": true
        }));
    }

    thread
}

fn steps_from_raw(raw: &str) -> Vec<serde_json::Value> {
    serde_json::from_str(raw).unwrap_or_default()
}

pub fn create(conn: &mut DbConn, new_task: NewTask) -> Result<Task, AppError> {
    diesel::insert_into(tasks_table)
        .values(&new_task)
        .returning(Task::as_returning())
        .get_result(conn)
        .map_err(AppError::from)
}

pub fn get(conn: &mut DbConn, task_id: &str) -> Result<Task, AppError> {
    tasks_table
        .filter(dsl::id.eq(task_id))
        .first(conn)
        .map_err(|e| match e {
            diesel::NotFound => AppError::NotFound(format!("task {task_id} not found")),
            other => AppError::Database(other),
        })
}

pub fn list(conn: &mut DbConn) -> Result<Vec<Task>, AppError> {
    tasks_table
        .order(dsl::created_at.desc())
        .load::<Task>(conn)
        .map_err(AppError::from)
}

pub fn list_paginated(
    conn: &mut DbConn,
    limit: i64,
    offset: i64,
    project_id: Option<&str>,
) -> Result<Vec<Task>, AppError> {
    if let Some(pid) = project_id {
        let project = crate::repo::project::get(conn, pid)?;
        let ids: Vec<String> = serde_json::from_str(&project.task_ids).unwrap_or_default();
        if ids.is_empty() {
            return Ok(vec![]);
        }
        return tasks_table
            .filter(dsl::id.eq_any(ids))
            .order(dsl::updated_at.desc())
            .limit(limit)
            .offset(offset)
            .load::<Task>(conn)
            .map_err(AppError::from);
    }

    tasks_table
        .order(dsl::updated_at.desc())
        .limit(limit)
        .offset(offset)
        .load::<Task>(conn)
        .map_err(AppError::from)
}

pub fn count(conn: &mut DbConn, project_id: Option<&str>) -> Result<i64, AppError> {
    use diesel::dsl::count_star;

    if let Some(pid) = project_id {
        let project = crate::repo::project::get(conn, pid)?;
        let ids: Vec<String> = serde_json::from_str(&project.task_ids).unwrap_or_default();
        if ids.is_empty() {
            return Ok(0);
        }
        return tasks_table
            .filter(dsl::id.eq_any(ids))
            .select(count_star())
            .first(conn)
            .map_err(AppError::from);
    }

    tasks_table
        .select(count_star())
        .first(conn)
        .map_err(AppError::from)
}

pub fn set_mode(
    conn: &mut DbConn,
    task_id: &str,
    mode_value: &str,
    mode_source_value: &str,
) -> Result<Task, AppError> {
    let now = chrono::Utc::now().timestamp_millis();
    diesel::update(tasks_table.filter(dsl::id.eq(task_id)))
        .set((
            dsl::mode.eq(mode_value),
            dsl::mode_source.eq(mode_source_value),
            dsl::updated_at.eq(now),
        ))
        .returning(Task::as_returning())
        .get_result(conn)
        .map_err(AppError::from)
}

pub fn set_status(
    conn: &mut DbConn,
    task_id: &str,
    new_status: &str,
) -> Result<Task, AppError> {
    let now = chrono::Utc::now().timestamp_millis();
    diesel::update(tasks_table.filter(dsl::id.eq(task_id)))
        .set((dsl::status.eq(new_status), dsl::updated_at.eq(now)))
        .returning(Task::as_returning())
        .get_result(conn)
        .map_err(AppError::from)
}

pub fn fail_task(conn: &mut DbConn, task_id: &str, reason: &str) -> Result<Task, AppError> {
    finalize_turn(conn, task_id, "failed", None, Some(reason.to_string()))
}

pub fn cancel(conn: &mut DbConn, task_id: &str) -> Result<Task, AppError> {
    let now = chrono::Utc::now().timestamp_millis();
    diesel::update(
        tasks_table
            .filter(dsl::id.eq(task_id))
            .filter(dsl::status.eq_any(vec!["pending", "running"])),
    )
    .set((dsl::status.eq("cancelled"), dsl::updated_at.eq(now)))
    .returning(Task::as_returning())
    .get_result(conn)
    .map_err(|e| match e {
        diesel::NotFound => AppError::NotFound(format!("task {task_id} not found")),
        other => AppError::Database(other),
    })
}

pub fn delete(conn: &mut DbConn, task_id: &str) -> Result<(), AppError> {
    diesel::delete(tasks_table.filter(dsl::id.eq(task_id))).execute(conn)?;
    Ok(())
}

pub fn apply_task_update(
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

    let final_summary = new_summary.or(existing.summary);
    let final_error = new_error.or(existing.error);

    diesel::update(tasks_table.filter(dsl::id.eq(task_id)))
        .set((
            dsl::status.eq(new_status),
            dsl::steps.eq(&new_steps),
            dsl::summary.eq(final_summary.as_deref()),
            dsl::error.eq(final_error.as_deref()),
            dsl::updated_at.eq(now),
        ))
        .returning(Task::as_returning())
        .get_result(conn)
        .map_err(AppError::from)
}

pub fn append_user_message(
    conn: &mut DbConn,
    task_id: &str,
    content: &str,
) -> Result<Task, AppError> {
    let now = chrono::Utc::now().timestamp_millis();
    let existing = get(conn, task_id)?;
    if !can_continue(&existing.status) {
        return Err(AppError::BadRequest(
            "Task is still running. Wait for the response before continuing.".into(),
        ));
    }

    let mut thread = bootstrap_thread(&existing);
    thread.push(json!({
        "role": "user",
        "content": content,
        "createdAt": now
    }));
    let messages_json =
        serde_json::to_string(&thread).unwrap_or_else(|_| existing.messages.clone());

    diesel::update(tasks_table.filter(dsl::id.eq(task_id)))
        .set((
            dsl::messages.eq(&messages_json),
            dsl::steps.eq("[]"),
            dsl::summary.eq(None::<&str>),
            dsl::error.eq(None::<&str>),
            dsl::status.eq("running"),
            dsl::updated_at.eq(now),
        ))
        .returning(Task::as_returning())
        .get_result(conn)
        .map_err(AppError::from)
}

pub fn finalize_turn(
    conn: &mut DbConn,
    task_id: &str,
    new_status: &str,
    assistant_content: Option<String>,
    new_error: Option<String>,
) -> Result<Task, AppError> {
    let now = chrono::Utc::now().timestamp_millis();
    let existing = get(conn, task_id)?;
    let turn_steps = steps_from_raw(&existing.steps);

    let mut thread = bootstrap_thread(&existing);
    if let Some(content) = assistant_content.as_ref().filter(|c| !c.trim().is_empty()) {
        let mut assistant = json!({
            "role": "assistant",
            "content": content,
            "createdAt": now
        });
        if !turn_steps.is_empty() {
            assistant["steps"] = json!(turn_steps);
        }
        thread.push(assistant);
    } else if let Some(err) = new_error.as_ref().filter(|e| !e.trim().is_empty()) {
        thread.push(json!({
            "role": "assistant",
            "content": err,
            "createdAt": now,
            "error": true
        }));
    }

    let messages_json =
        serde_json::to_string(&thread).unwrap_or_else(|_| existing.messages.clone());

    diesel::update(tasks_table.filter(dsl::id.eq(task_id)))
        .set((
            dsl::messages.eq(&messages_json),
            dsl::steps.eq("[]"),
            dsl::status.eq(new_status),
            dsl::summary.eq(assistant_content.as_deref()),
            dsl::error.eq(new_error.as_deref()),
            dsl::updated_at.eq(now),
        ))
        .returning(Task::as_returning())
        .get_result(conn)
        .map_err(AppError::from)
}
