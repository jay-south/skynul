use diesel::prelude::*;
use serde_json::Value;

use crate::db::DbConn;
use crate::error::AppError;
use crate::models::policy::PolicyRecord;
use crate::schema::policy::dsl::*;

pub fn get(conn: &mut DbConn) -> Result<PolicyRecord, AppError> {
    policy.first(conn).map_err(AppError::from)
}

pub fn update(conn: &mut DbConn, record: PolicyRecord) -> Result<PolicyRecord, AppError> {
    diesel::update(policy.filter(id.eq(record.id)))
        .set((
            capabilities.eq(&record.capabilities),
            theme_mode.eq(&record.theme_mode),
            language.eq(&record.language),
            provider_active.eq(&record.provider_active),
            provider_model.eq(record.provider_model.as_deref()),
            agent_prompt_append.eq(&record.agent_prompt_append),
        ))
        .returning(PolicyRecord::as_returning())
        .get_result(conn)
        .map_err(AppError::from)
}

pub fn patch_general(
    conn: &mut DbConn,
    language_value: Option<&str>,
    theme_mode_value: Option<&str>,
    agent_prompt_append_value: Option<&str>,
) -> Result<PolicyRecord, AppError> {
    let record = get(conn)?;
    diesel::update(policy.filter(id.eq(1)))
        .set((
            language.eq(language_value.unwrap_or(&record.language)),
            theme_mode.eq(theme_mode_value.unwrap_or(&record.theme_mode)),
            agent_prompt_append.eq(agent_prompt_append_value.unwrap_or(&record.agent_prompt_append)),
        ))
        .returning(PolicyRecord::as_returning())
        .get_result(conn)
        .map_err(AppError::from)
}

pub fn patch_capabilities(
    conn: &mut DbConn,
    patch: &serde_json::Map<String, Value>,
) -> Result<PolicyRecord, AppError> {
    let record = get(conn)?;
    let mut caps: serde_json::Map<String, Value> =
        serde_json::from_str(&record.capabilities).unwrap_or_default();
    for (key, value) in patch {
        caps.insert(key.clone(), value.clone());
    }
    let caps_json = serde_json::to_string(&caps).unwrap_or_default();
    update_capabilities(conn, &caps_json)
}

pub fn update_capabilities(conn: &mut DbConn, val: &str) -> Result<PolicyRecord, AppError> {
    diesel::update(policy.filter(id.eq(1)))
        .set(capabilities.eq(val))
        .returning(PolicyRecord::as_returning())
        .get_result(conn)
        .map_err(AppError::from)
}

pub fn patch_model(
    conn: &mut DbConn,
    active_provider: Option<&str>,
    model: Option<&str>,
    update_model: bool,
) -> Result<PolicyRecord, AppError> {
    let record = get(conn)?;
    let provider = active_provider.unwrap_or(&record.provider_active);
    if update_model {
        diesel::update(policy.filter(id.eq(1)))
            .set((provider_active.eq(provider), provider_model.eq(model)))
            .returning(PolicyRecord::as_returning())
            .get_result(conn)
            .map_err(AppError::from)
    } else if active_provider.is_some() {
        diesel::update(policy.filter(id.eq(1)))
            .set(provider_active.eq(provider))
            .returning(PolicyRecord::as_returning())
            .get_result(conn)
            .map_err(AppError::from)
    } else {
        Ok(record)
    }
}
