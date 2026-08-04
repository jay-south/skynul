use diesel::prelude::*;
use serde::{Deserialize, Serialize};

use crate::schema::provider_credentials;

#[derive(Debug, Clone, Queryable, Identifiable, Selectable, Serialize, Deserialize)]
#[diesel(table_name = provider_credentials, primary_key(provider_id))]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct ProviderCredential {
    pub provider_id: String,
    pub api_key: String,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Insertable, Serialize, Deserialize)]
#[diesel(table_name = provider_credentials)]
pub struct NewProviderCredential {
    pub provider_id: String,
    pub api_key: String,
    pub updated_at: i64,
}
