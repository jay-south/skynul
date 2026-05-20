use diesel::prelude::*;
use serde::{Deserialize, Serialize};

use crate::schema::projects;

#[derive(Debug, Clone, Queryable, Identifiable, Selectable, Insertable, Serialize, Deserialize)]
#[diesel(table_name = projects, check_for_backend(diesel::sqlite::Sqlite))]
pub struct Project {
    pub id: String,
    pub name: String,
    pub color: String,
    pub created_at: i64,
    pub task_ids: String,
}

#[derive(Debug, Clone, Insertable, Serialize, Deserialize)]
#[diesel(table_name = projects)]
pub struct NewProject {
    pub id: String,
    pub name: String,
    pub color: String,
    pub created_at: i64,
    pub task_ids: String,
}
