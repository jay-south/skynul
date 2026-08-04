use diesel::prelude::*;
use serde_json::Value;

use crate::db::DbConn;
use crate::error::AppError;
use crate::models::channel::{Channel, NewChannel};
use crate::schema::channels::dsl::*;

const CHANNEL_IDS: &[&str] = &["telegram", "whatsapp", "discord", "signal", "slack"];

pub fn list(conn: &mut DbConn) -> Result<Vec<Channel>, AppError> {
    let existing: Vec<Channel> = channels.load::<Channel>(conn)?;
    let existing_ids: std::collections::HashSet<String> =
        existing.iter().map(|c| c.id.clone()).collect();

    let mut result = existing;
    for &cid in CHANNEL_IDS {
        if !existing_ids.contains(cid) {
            let new = NewChannel {
                id: cid.to_string(),
                enabled: false,
                status: "disconnected".to_string(),
                paired: false,
                pairing_code: None,
                error: None,
                has_credentials: false,
                meta: "{}".to_string(),
            };
            let inserted = diesel::insert_into(channels)
                .values(&new)
                .returning(Channel::as_returning())
                .get_result(conn)?;
            result.push(inserted);
        }
    }

    Ok(result)
}

pub fn get(conn: &mut DbConn, channel_id: &str) -> Result<Channel, AppError> {
    list(conn)?;
    channels
        .filter(id.eq(channel_id))
        .first(conn)
        .map_err(|e| match e {
            diesel::NotFound => AppError::NotFound(format!("channel {channel_id} not found")),
            other => AppError::Database(other),
        })
}

pub fn patch(
    conn: &mut DbConn,
    channel_id: &str,
    enabled_value: Option<bool>,
    credentials: Option<&serde_json::Map<String, Value>>,
) -> Result<Channel, AppError> {
    if enabled_value.is_none() && credentials.is_none() {
        return Err(AppError::BadRequest("no fields to update".into()));
    }

    if let Some(val) = enabled_value {
        diesel::update(channels.filter(id.eq(channel_id)))
            .set(enabled.eq(val))
            .execute(conn)?;
    }

    if let Some(creds) = credentials {
        let meta_json = serde_json::to_string(creds).unwrap_or_else(|_| "{}".to_string());
        diesel::update(channels.filter(id.eq(channel_id)))
            .set((meta.eq(meta_json), has_credentials.eq(true)))
            .execute(conn)?;
    }

    get(conn, channel_id)
}

pub fn generate_pairing(conn: &mut DbConn, channel_id: &str) -> Result<String, AppError> {
    let code = uuid::Uuid::new_v4().to_string()[..6].to_string();
    diesel::update(channels.filter(id.eq(channel_id)))
        .set((pairing_code.eq(&code), paired.eq(false)))
        .returning(Channel::as_returning())
        .get_result(conn)
        .map_err(|e| match e {
            diesel::NotFound => AppError::NotFound(format!("channel {channel_id} not found")),
            other => AppError::Database(other),
        })?;
    Ok(code)
}

pub fn unpair(conn: &mut DbConn, channel_id: &str) -> Result<(), AppError> {
    let channel = get(conn, channel_id)?;
    let mut meta_map: serde_json::Map<String, serde_json::Value> =
        serde_json::from_str(&channel.meta).unwrap_or_default();
    meta_map.remove("pairedChatId");
    let meta_str = serde_json::to_string(&meta_map).unwrap_or_else(|_| "{}".to_string());

    diesel::update(channels.filter(id.eq(channel_id)))
        .set((
            paired.eq(false),
            pairing_code.eq::<Option<String>>(None),
            meta.eq(meta_str),
        ))
        .execute(conn)?;
    Ok(())
}

pub fn confirm_pairing(conn: &mut DbConn, channel_id: &str, chat_id: i64) -> Result<(), AppError> {
    let channel = get(conn, channel_id)?;
    let mut meta_map: serde_json::Map<String, serde_json::Value> =
        serde_json::from_str(&channel.meta).unwrap_or_default();
    meta_map.insert("pairedChatId".into(), serde_json::json!(chat_id));
    let meta_str = serde_json::to_string(&meta_map).unwrap_or_else(|_| "{}".to_string());

    diesel::update(channels.filter(id.eq(channel_id)))
        .set((
            paired.eq(true),
            pairing_code.eq::<Option<String>>(None),
            meta.eq(meta_str),
        ))
        .execute(conn)?;
    Ok(())
}

pub fn set_status(
    conn: &mut DbConn,
    channel_id: &str,
    status_value: &str,
    error_value: Option<&str>,
) -> Result<(), AppError> {
    diesel::update(channels.filter(id.eq(channel_id)))
        .set((status.eq(status_value), error.eq(error_value)))
        .execute(conn)?;
    Ok(())
}
