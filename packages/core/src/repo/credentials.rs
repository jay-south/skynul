use diesel::prelude::*;

use crate::db::DbConn;
use crate::error::AppError;
use crate::models::provider_credential::{NewProviderCredential, ProviderCredential};
use crate::schema::provider_credentials::dsl::*;

pub fn get(conn: &mut DbConn, provider: &str) -> Result<Option<String>, AppError> {
    provider_credentials
        .filter(provider_id.eq(provider))
        .select(api_key)
        .first(conn)
        .optional()
        .map_err(AppError::from)
}

pub fn upsert(conn: &mut DbConn, provider: &str, key: &str) -> Result<(), AppError> {
    let now = chrono::Utc::now().timestamp_millis();
    let row = NewProviderCredential {
        provider_id: provider.to_string(),
        api_key: key.to_string(),
        updated_at: now,
    };

    diesel::replace_into(provider_credentials)
        .values(&row)
        .execute(conn)?;

    Ok(())
}

pub fn delete(conn: &mut DbConn, provider: &str) -> Result<(), AppError> {
    diesel::delete(provider_credentials.filter(provider_id.eq(provider))).execute(conn)?;
    Ok(())
}

pub fn list(conn: &mut DbConn) -> Result<Vec<ProviderCredential>, AppError> {
    provider_credentials
        .load::<ProviderCredential>(conn)
        .map_err(AppError::from)
}
