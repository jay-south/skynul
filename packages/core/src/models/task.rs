use diesel::prelude::*;
use serde::{Deserialize, Serialize};

use crate::schema::tasks;

#[derive(Debug, Clone, Queryable, Identifiable, Selectable, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[diesel(table_name = tasks, check_for_backend(diesel::sqlite::Sqlite))]
pub struct Task {
    pub id: String,
    pub prompt: String,
    pub attachments: Option<String>,
    pub status: String,
    pub mode: String,
    pub capabilities: String,
    pub steps: String,
    pub usage: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub max_steps: i64,
    pub timeout_ms: i64,
    pub error: Option<String>,
    pub summary: Option<String>,
    pub source: Option<String>,
    pub source_chat_id: Option<i64>,
    pub mode_reasoning: Option<String>,
    pub mode_source: String,
    pub messages: String,
}

#[derive(Debug, Clone, Insertable, Serialize, Deserialize)]
#[diesel(table_name = tasks)]
pub struct NewTask {
    pub id: String,
    pub prompt: String,
    pub attachments: Option<String>,
    pub status: String,
    pub mode: String,
    pub capabilities: String,
    pub steps: String,
    pub usage: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub max_steps: i64,
    pub timeout_ms: i64,
    pub error: Option<String>,
    pub summary: Option<String>,
    pub source: Option<String>,
    pub source_chat_id: Option<i64>,
    pub mode_reasoning: Option<String>,
    pub mode_source: String,
    pub messages: String,
}
