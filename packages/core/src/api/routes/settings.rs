use axum::extract::State;
use axum::routing::get;
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};

use crate::api::state::AppState;
use crate::api::types::{PatchPermissionsSettings, PermissionLevel, PermissionsSettings};
use crate::db::get_conn;
use crate::error::AppError;
use crate::models::policy::PolicyRecord;
use crate::policy::{ParsedPolicy, PermissionLevel as PolicyPermissionLevel};
use crate::repo;
use crate::secrets::SecretsStore;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GeneralSettingsResponse {
    pub language: String,
    pub theme_mode: String,
    pub agent_prompt_append: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PatchGeneralSettingsBody {
    pub language: Option<String>,
    pub theme_mode: Option<String>,
    pub agent_prompt_append: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderSummaryResponse {
    pub id: String,
    pub configured: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelSettingsResponse {
    pub active_provider: String,
    pub model: Option<String>,
    pub providers: Vec<ProviderSummaryResponse>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PatchModelSettingsBody {
    pub active_provider: Option<String>,
    pub model: Option<String>,
}

fn general_from_record(record: &PolicyRecord) -> GeneralSettingsResponse {
    GeneralSettingsResponse {
        language: record.language.clone(),
        theme_mode: record.theme_mode.clone(),
        agent_prompt_append: record.agent_prompt_append.clone(),
    }
}

fn to_api_level(level: PolicyPermissionLevel) -> PermissionLevel {
    match level {
        PolicyPermissionLevel::Deny => PermissionLevel::Deny,
        PolicyPermissionLevel::Ask => PermissionLevel::Ask,
        PolicyPermissionLevel::Allow => PermissionLevel::Allow,
    }
}

fn permissions_from_record(record: &PolicyRecord) -> PermissionsSettings {
    let parsed = ParsedPolicy::from_record(record);
    PermissionsSettings {
        fs_read: to_api_level(parsed.fs_read),
        fs_write: to_api_level(parsed.fs_write),
        cmd_run: to_api_level(parsed.cmd_run),
        net_http: to_api_level(parsed.net_http),
    }
}

fn level_to_json(level: PermissionLevel) -> Value {
    match level {
        PermissionLevel::Allow => json!(true),
        PermissionLevel::Deny => json!(false),
        PermissionLevel::Ask => json!("ask"),
    }
}

fn patch_body_to_capabilities(body: &PatchPermissionsSettings) -> Result<Map<String, Value>, AppError> {
    let mut patch = Map::new();
    if let Some(value) = body.fs_read {
        patch.insert("fs.read".into(), level_to_json(value));
    }
    if let Some(value) = body.fs_write {
        patch.insert("fs.write".into(), level_to_json(value));
    }
    if let Some(value) = body.cmd_run {
        patch.insert("cmd.run".into(), level_to_json(value));
    }
    if let Some(value) = body.net_http {
        patch.insert("net.http".into(), level_to_json(value));
    }
    if patch.is_empty() {
        return Err(AppError::BadRequest("no fields to update".into()));
    }
    Ok(patch)
}

fn model_from_record(record: &PolicyRecord, secrets: &SecretsStore) -> ModelSettingsResponse {
    let status = secrets.status_map();
    ModelSettingsResponse {
        active_provider: record.provider_active.clone(),
        model: record.provider_model.clone(),
        providers: status
            .into_iter()
            .map(|(id, configured)| ProviderSummaryResponse { id, configured })
            .collect(),
    }
}

async fn get_general_settings(
    State(state): State<AppState>,
) -> Result<Json<GeneralSettingsResponse>, AppError> {
    let mut conn = get_conn(&state.pool)?;
    let record = repo::policy::get(&mut conn)?;
    Ok(Json(general_from_record(&record)))
}

async fn patch_general_settings(
    State(state): State<AppState>,
    Json(body): Json<PatchGeneralSettingsBody>,
) -> Result<Json<GeneralSettingsResponse>, AppError> {
    if body.language.is_none() && body.theme_mode.is_none() && body.agent_prompt_append.is_none() {
        return Err(AppError::BadRequest("no fields to update".into()));
    }
    let mut conn = get_conn(&state.pool)?;
    let record = repo::policy::patch_general(
        &mut conn,
        body.language.as_deref(),
        body.theme_mode.as_deref(),
        body.agent_prompt_append.as_deref(),
    )?;
    Ok(Json(general_from_record(&record)))
}

async fn get_permissions_settings(
    State(state): State<AppState>,
) -> Result<Json<PermissionsSettings>, AppError> {
    let mut conn = get_conn(&state.pool)?;
    let record = repo::policy::get(&mut conn)?;
    Ok(Json(permissions_from_record(&record)))
}

async fn patch_permissions_settings(
    State(state): State<AppState>,
    Json(body): Json<PatchPermissionsSettings>,
) -> Result<Json<PermissionsSettings>, AppError> {
    let patch = patch_body_to_capabilities(&body)?;
    let mut conn = get_conn(&state.pool)?;
    let record = repo::policy::patch_capabilities(&mut conn, &patch)?;
    Ok(Json(permissions_from_record(&record)))
}

async fn get_model_settings(
    State(state): State<AppState>,
) -> Result<Json<ModelSettingsResponse>, AppError> {
    let record = {
        let mut conn = get_conn(&state.pool)?;
        repo::policy::get(&mut conn)?
    };
    Ok(Json(model_from_record(&record, &state.secrets)))
}

async fn patch_model_settings(
    State(state): State<AppState>,
    Json(body): Json<PatchModelSettingsBody>,
) -> Result<Json<ModelSettingsResponse>, AppError> {
    if body.active_provider.is_none() && body.model.is_none() {
        return Err(AppError::BadRequest("no fields to update".into()));
    }
    let record = {
        let mut conn = get_conn(&state.pool)?;
        repo::policy::patch_model(
            &mut conn,
            body.active_provider.as_deref(),
            body.model.as_deref(),
            body.model.is_some(),
        )?
    };
    Ok(Json(model_from_record(&record, &state.secrets)))
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route(
            "/settings/general",
            get(get_general_settings).patch(patch_general_settings),
        )
        .route(
            "/settings/permissions",
            get(get_permissions_settings).patch(patch_permissions_settings),
        )
        .route(
            "/settings/model",
            get(get_model_settings).patch(patch_model_settings),
        )
}
