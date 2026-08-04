use std::io::{BufRead, Write};

use serde::{Deserialize, Serialize};
use skynul_core::db::establish_pool;
use skynul_core::models::task::NewTask;
use skynul_core::repo;
use skynul_core::policy::parse_create_mode;

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "method", rename_all = "snake_case")]
enum CliRequest {
    CreateTask {
        prompt: String,
        attachments: Option<Vec<String>>,
        mode: Option<String>,
        max_steps: Option<i64>,
        timeout_ms: Option<i64>,
        source: Option<String>,
    },
    GetTask { task_id: String },
    ListTasks,
    CancelTask { task_id: String },
    DeleteTask { task_id: String },
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum CliResponse {
    Ok,
    Task(serde_json::Value),
    TaskList(Vec<serde_json::Value>),
    Error { message: String },
}

fn main() {
    let db_path = std::env::var("SKYNUL_DB_PATH").ok();
    let pool = establish_pool(db_path.as_deref()).expect("failed to init database");
    let stdin = std::io::stdin();
    let stdout = std::io::stdout();

    for line in stdin.lock().lines() {
        let line = match line {
            Ok(l) => l,
            Err(e) => {
                eprintln!("read error: {e}");
                continue;
            }
        };

        let req: CliRequest = match serde_json::from_str(&line) {
            Ok(r) => r,
            Err(e) => {
                let resp = CliResponse::Error { message: format!("parse error: {e}") };
                writeln!(stdout.lock(), "{}", serde_json::to_string(&resp).unwrap()).unwrap();
                continue;
            }
        };

        let resp = handle_request(&pool, req);
        writeln!(stdout.lock(), "{}", serde_json::to_string(&resp).unwrap()).unwrap();
    }
}

fn handle_request(pool: &skynul_core::db::DbPool, req: CliRequest) -> CliResponse {
    let mut conn = match skynul_core::db::get_conn(pool) {
        Ok(c) => c,
        Err(e) => return CliResponse::Error { message: e.to_string() },
    };

    match req {
        CliRequest::CreateTask { prompt, attachments, mode, max_steps, timeout_ms, source } => {
            let now = chrono::Utc::now().timestamp_millis();
            let (initial_mode, mode_source) = parse_create_mode(mode.as_deref());
            let messages = repo::task::initial_messages_json(&prompt, now);
            let new_task = NewTask {
                id: uuid::Uuid::new_v4().to_string(),
                prompt,
                attachments: attachments.map(|a| serde_json::to_string(&a).unwrap_or_default()),
                status: "running".to_string(),
                mode: initial_mode,
                capabilities: "[]".to_string(),
                steps: "[]".to_string(),
                usage: None,
                created_at: now,
                updated_at: now,
                max_steps: max_steps.unwrap_or(200),
                timeout_ms: timeout_ms.unwrap_or(30 * 60 * 1000),
                error: None,
                summary: None,
                source,
                source_chat_id: None,
                mode_reasoning: None,
                mode_source: mode_source.to_string(),
                messages,
            };
            match repo::task::create(&mut conn, new_task) {
                Ok(task) => CliResponse::Task(serde_json::to_value(task).unwrap_or_default()),
                Err(e) => CliResponse::Error { message: e.to_string() },
            }
        }
        CliRequest::GetTask { task_id } => match repo::task::get(&mut conn, &task_id) {
            Ok(task) => CliResponse::Task(serde_json::to_value(task).unwrap_or_default()),
            Err(e) => CliResponse::Error { message: e.to_string() },
        },
        CliRequest::ListTasks => match repo::task::list(&mut conn) {
            Ok(tasks) => CliResponse::TaskList(
                tasks.into_iter().map(|t| serde_json::to_value(t).unwrap_or_default()).collect()
            ),
            Err(e) => CliResponse::Error { message: e.to_string() },
        },
        CliRequest::CancelTask { task_id } => match repo::task::cancel(&mut conn, &task_id) {
            Ok(task) => CliResponse::Task(serde_json::to_value(task).unwrap_or_default()),
            Err(e) => CliResponse::Error { message: e.to_string() },
        },
        CliRequest::DeleteTask { task_id } => match repo::task::delete(&mut conn, &task_id) {
            Ok(()) => CliResponse::Ok,
            Err(e) => CliResponse::Error { message: e.to_string() },
        },
    }
}
