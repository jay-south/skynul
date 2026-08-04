use diesel::prelude::*;
use serde::{Deserialize, Serialize};

use crate::schema::channels;

#[derive(Debug, Clone, Queryable, Identifiable, Selectable, Insertable, Serialize, Deserialize)]
#[diesel(table_name = channels, check_for_backend(diesel::sqlite::Sqlite))]
pub struct Channel {
    pub id: String,
    pub enabled: bool,
    pub status: String,
    pub paired: bool,
    pub pairing_code: Option<String>,
    pub error: Option<String>,
    pub has_credentials: bool,
    pub meta: String,
}

#[derive(Debug, Clone, Insertable, Serialize, Deserialize)]
#[diesel(table_name = channels)]
pub struct NewChannel {
    pub id: String,
    pub enabled: bool,
    pub status: String,
    pub paired: bool,
    pub pairing_code: Option<String>,
    pub error: Option<String>,
    pub has_credentials: bool,
    pub meta: String,
}
