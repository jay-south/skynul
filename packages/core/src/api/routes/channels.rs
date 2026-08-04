use axum::extract::{Path, State};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

use crate::api::state::AppState;
use crate::db::get_conn;
use crate::error::AppError;
use crate::models::channel::Channel;
use crate::repo;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelResponse {
    pub id: String,
    pub enabled: bool,
    pub status: String,
    pub paired: bool,
    pub pairing_code: Option<String>,
    pub error: Option<String>,
    pub has_credentials: bool,
    pub meta: Value,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelListResponse {
    pub channels: Vec<ChannelResponse>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PatchChannelBody {
    pub enabled: Option<bool>,
    pub credentials: Option<Map<String, Value>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingCodeResponse {
    pub code: String,
}

fn channel_to_response(channel: Channel) -> Result<ChannelResponse, AppError> {
    let meta: Value = serde_json::from_str(&channel.meta).unwrap_or(Value::Object(Map::new()));
    Ok(ChannelResponse {
        id: channel.id,
        enabled: channel.enabled,
        status: channel.status,
        paired: channel.paired,
        pairing_code: channel.pairing_code,
        error: channel.error,
        has_credentials: channel.has_credentials,
        meta,
    })
}

async fn list_channels(
    State(state): State<AppState>,
) -> Result<Json<ChannelListResponse>, AppError> {
    let mut conn = get_conn(&state.pool)?;
    let channels = repo::channel::list(&mut conn)?;
    let channels = channels
        .into_iter()
        .map(channel_to_response)
        .collect::<Result<Vec<_>, _>>()?;
    Ok(Json(ChannelListResponse { channels }))
}

async fn get_channel(
    State(state): State<AppState>,
    Path(channel_id): Path<String>,
) -> Result<Json<ChannelResponse>, AppError> {
    let mut conn = get_conn(&state.pool)?;
    let channel = repo::channel::get(&mut conn, &channel_id)?;
    Ok(Json(channel_to_response(channel)?))
}

async fn patch_channel(
    State(state): State<AppState>,
    Path(channel_id): Path<String>,
    Json(body): Json<PatchChannelBody>,
) -> Result<Json<ChannelResponse>, AppError> {
    let mut conn = get_conn(&state.pool)?;
    let channel = repo::channel::patch(
        &mut conn,
        &channel_id,
        body.enabled,
        body.credentials.as_ref(),
    )?;
    state.channels.reload(&channel_id).await;
    Ok(Json(channel_to_response(channel)?))
}

async fn create_channel_pairing(
    State(state): State<AppState>,
    Path(channel_id): Path<String>,
) -> Result<Json<PairingCodeResponse>, AppError> {
    let mut conn = get_conn(&state.pool)?;
    let code = repo::channel::generate_pairing(&mut conn, &channel_id)?;
    state.channels.reload(&channel_id).await;
    Ok(Json(PairingCodeResponse { code }))
}

async fn delete_channel_pairing(
    State(state): State<AppState>,
    Path(channel_id): Path<String>,
) -> Result<Json<ChannelResponse>, AppError> {
    let mut conn = get_conn(&state.pool)?;
    repo::channel::unpair(&mut conn, &channel_id)?;
    let channel = repo::channel::get(&mut conn, &channel_id)?;
    state.channels.reload(&channel_id).await;
    Ok(Json(channel_to_response(channel)?))
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/channels", get(list_channels))
        .route(
            "/channels/{id}",
            get(get_channel).patch(patch_channel),
        )
        .route(
            "/channels/{id}/pairing",
            post(create_channel_pairing).delete(delete_channel_pairing),
        )
}
