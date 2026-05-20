use diesel::prelude::*;

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
            workspace_root.eq(record.workspace_root.as_deref()),
            capabilities.eq(&record.capabilities),
            theme_mode.eq(&record.theme_mode),
            language.eq(&record.language),
            provider_active.eq(&record.provider_active),
            provider_model.eq(record.provider_model.as_deref()),
            task_auto_approve.eq(record.task_auto_approve),
        ))
        .returning(PolicyRecord::as_returning())
        .get_result(conn)
        .map_err(AppError::from)
}

pub fn update_workspace_root(conn: &mut DbConn, val: Option<&str>) -> Result<PolicyRecord, AppError> {
    diesel::update(policy.filter(id.eq(1)))
        .set(workspace_root.eq(val))
        .returning(PolicyRecord::as_returning())
        .get_result(conn)
        .map_err(AppError::from)
}

pub fn update_capabilities(conn: &mut DbConn, val: &str) -> Result<PolicyRecord, AppError> {
    diesel::update(policy.filter(id.eq(1)))
        .set(capabilities.eq(val))
        .returning(PolicyRecord::as_returning())
        .get_result(conn)
        .map_err(AppError::from)
}

pub fn update_theme_mode(conn: &mut DbConn, val: &str) -> Result<PolicyRecord, AppError> {
    diesel::update(policy.filter(id.eq(1)))
        .set(theme_mode.eq(val))
        .returning(PolicyRecord::as_returning())
        .get_result(conn)
        .map_err(AppError::from)
}

pub fn update_language(conn: &mut DbConn, val: &str) -> Result<PolicyRecord, AppError> {
    diesel::update(policy.filter(id.eq(1)))
        .set(language.eq(val))
        .returning(PolicyRecord::as_returning())
        .get_result(conn)
        .map_err(AppError::from)
}

pub fn update_provider(conn: &mut DbConn, active: &str, model: Option<&str>) -> Result<PolicyRecord, AppError> {
    diesel::update(policy.filter(id.eq(1)))
        .set((provider_active.eq(active), provider_model.eq(model)))
        .returning(PolicyRecord::as_returning())
        .get_result(conn)
        .map_err(AppError::from)
}

pub fn update_provider_model(conn: &mut DbConn, val: &str) -> Result<PolicyRecord, AppError> {
    diesel::update(policy.filter(id.eq(1)))
        .set(provider_model.eq(val))
        .returning(PolicyRecord::as_returning())
        .get_result(conn)
        .map_err(AppError::from)
}

pub fn update_auto_approve(conn: &mut DbConn, val: bool) -> Result<PolicyRecord, AppError> {
    diesel::update(policy.filter(id.eq(1)))
        .set(task_auto_approve.eq(val))
        .returning(PolicyRecord::as_returning())
        .get_result(conn)
        .map_err(AppError::from)
}
