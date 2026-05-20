use diesel::prelude::*;
use serde::{Deserialize, Serialize};

use crate::schema::schedules;

#[derive(Debug, Clone, Queryable, Identifiable, Selectable, Insertable, Serialize, Deserialize)]
#[diesel(table_name = schedules, check_for_backend(diesel::sqlite::Sqlite))]
pub struct Schedule {
    pub id: String,
    pub prompt: String,
    pub capabilities: String,
    pub mode: String,
    pub frequency: String,
    pub cron_expr: String,
    pub enabled: bool,
    pub last_run_at: Option<i64>,
    pub next_run_at: i64,
    pub created_at: i64,
}

#[derive(Debug, Clone, Insertable, Serialize, Deserialize)]
#[diesel(table_name = schedules)]
pub struct NewSchedule {
    pub id: String,
    pub prompt: String,
    pub capabilities: String,
    pub mode: String,
    pub frequency: String,
    pub cron_expr: String,
    pub enabled: bool,
    pub last_run_at: Option<i64>,
    pub next_run_at: i64,
    pub created_at: i64,
}
