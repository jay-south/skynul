use diesel::prelude::*;
use serde::{Deserialize, Serialize};

use crate::schema::policy;

#[derive(Debug, Clone, Queryable, Identifiable, Selectable, Insertable, Serialize, Deserialize)]
#[diesel(table_name = policy, check_for_backend(diesel::sqlite::Sqlite))]
pub struct PolicyRecord {
    pub id: i32,
    pub capabilities: String,
    pub theme_mode: String,
    pub language: String,
    pub provider_active: String,
    pub provider_model: Option<String>,
    pub agent_prompt_append: String,
}
