use std::collections::HashMap;

use crate::api::types::{TaskMessageResponse, TaskResponse, TaskStepResponse};
use crate::db::DbConn;
use crate::models::task::Task;
use crate::repo;

pub(crate) fn millis_to_iso(ms: i64) -> String {
    chrono::DateTime::from_timestamp_millis(ms)
        .map(|dt| dt.to_rfc3339())
        .unwrap_or_else(|| ms.to_string())
}

pub(crate) fn project_map(conn: &mut DbConn) -> HashMap<String, String> {
    let mut map = HashMap::new();
    if let Ok(projects) = repo::project::list(conn) {
        for project in projects {
            let ids: Vec<String> = serde_json::from_str(&project.task_ids).unwrap_or_default();
            for task_id in ids {
                map.insert(task_id, project.id.clone());
            }
        }
    }
    map
}

pub(crate) fn task_to_response(task: &Task, project_id: Option<String>) -> TaskResponse {
    let messages = parse_task_messages(task);
    let has_thread = messages.as_ref().is_some_and(|m| !m.is_empty());
    let steps = if task.status == "running" {
        parse_task_steps(&task.steps)
    } else {
        None
    };
    TaskResponse {
        id: task.id.clone(),
        status: task.status.clone(),
        prompt: task.prompt.clone(),
        summary: if has_thread { None } else { task.summary.clone() },
        error: if has_thread && task.status == "completed" {
            None
        } else {
            task.error.clone()
        },
        created_at: millis_to_iso(task.created_at),
        updated_at: millis_to_iso(task.updated_at),
        project_id,
        steps,
        messages,
    }
}

fn parse_task_steps(raw: &str) -> Option<Vec<TaskStepResponse>> {
    parse_steps_values(raw)
}

fn parse_steps_values(raw: &str) -> Option<Vec<TaskStepResponse>> {
    let values: Vec<serde_json::Value> = serde_json::from_str(raw).ok()?;
    if values.is_empty() {
        return None;
    }
    let steps = values
        .into_iter()
        .filter_map(step_value_to_response)
        .collect::<Vec<_>>();
    if steps.is_empty() {
        None
    } else {
        Some(steps)
    }
}

fn step_value_to_response(step: serde_json::Value) -> Option<TaskStepResponse> {
    Some(TaskStepResponse {
        tool: step.get("tool")?.as_str()?.to_string(),
        arguments: step
            .get("arguments")
            .and_then(|v| v.as_str())
            .map(str::to_string),
        result: step
            .get("result")
            .and_then(|v| v.as_str())
            .map(str::to_string),
        error: step
            .get("error")
            .and_then(|v| v.as_str())
            .map(str::to_string),
    })
}

fn parse_task_messages(task: &Task) -> Option<Vec<TaskMessageResponse>> {
    let values: Vec<serde_json::Value> = serde_json::from_str(&task.messages).unwrap_or_default();
    if !values.is_empty() {
        let messages = values
            .into_iter()
            .filter_map(message_value_to_response)
            .collect::<Vec<_>>();
        if messages.is_empty() {
            return None;
        }
        return Some(messages);
    }

    let mut legacy = Vec::new();
    legacy.push(TaskMessageResponse {
        role: "user".to_string(),
        content: task.prompt.clone(),
        steps: None,
        created_at: millis_to_iso(task.created_at),
        error: None,
    });
    if let Some(summary) = task.summary.as_ref().filter(|s| !s.trim().is_empty()) {
        legacy.push(TaskMessageResponse {
            role: "assistant".to_string(),
            content: summary.clone(),
            steps: parse_task_steps(&task.steps),
            created_at: millis_to_iso(task.updated_at),
            error: None,
        });
    } else if let Some(err) = task.error.as_ref().filter(|s| !s.trim().is_empty()) {
        legacy.push(TaskMessageResponse {
            role: "assistant".to_string(),
            content: err.clone(),
            steps: None,
            created_at: millis_to_iso(task.updated_at),
            error: Some(true),
        });
    }
    if legacy.len() <= 1 && task.status == "running" {
        Some(legacy)
    } else if legacy.len() > 1 {
        Some(legacy)
    } else {
        Some(legacy)
    }
}

fn message_value_to_response(value: serde_json::Value) -> Option<TaskMessageResponse> {
    let created_at = value
        .get("createdAt")
        .and_then(|v| v.as_i64())
        .map(millis_to_iso)
        .unwrap_or_default();
    let steps = value
        .get("steps")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .cloned()
                .filter_map(step_value_to_response)
                .collect::<Vec<_>>()
        })
        .filter(|steps| !steps.is_empty());

    Some(TaskMessageResponse {
        role: value.get("role")?.as_str()?.to_string(),
        content: value.get("content")?.as_str()?.to_string(),
        steps,
        created_at,
        error: value.get("error").and_then(|v| v.as_bool()),
    })
}
