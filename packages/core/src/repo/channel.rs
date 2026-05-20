use diesel::prelude::*;

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
                auto_approve: false,
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

pub fn get_global(conn: &mut DbConn) -> Result<ChannelGlobal, AppError> {
    let all: Vec<Channel> = channels.load::<Channel>(conn)?;
    let auto_approve_val = all.iter().any(|c| c.auto_approve);
    Ok(ChannelGlobal { auto_approve: auto_approve_val })
}

pub fn update_enabled(conn: &mut DbConn, channel_id: &str, val: bool) -> Result<Channel, AppError> {
    diesel::update(channels.filter(id.eq(channel_id)))
        .set(enabled.eq(val))
        .returning(Channel::as_returning())
        .get_result(conn)
        .map_err(|e| match e {
            diesel::NotFound => AppError::NotFound(format!("channel {channel_id} not found")),
            other => AppError::Database(other),
        })
}

pub fn update_credentials(conn: &mut DbConn, channel_id: &str, meta_json: &str) -> Result<(), AppError> {
    diesel::update(channels.filter(id.eq(channel_id)))
        .set((meta.eq(meta_json), has_credentials.eq(true)))
        .execute(conn)?;
    Ok(())
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
    diesel::update(channels.filter(id.eq(channel_id)))
        .set((paired.eq(false), pairing_code.eq::<Option<String>>(None)))
        .execute(conn)?;
    Ok(())
}

pub fn update_auto_approve(conn: &mut DbConn, val: bool) -> Result<ChannelGlobal, AppError> {
    diesel::update(channels)
        .set(auto_approve.eq(val))
        .execute(conn)?;
    Ok(ChannelGlobal { auto_approve: val })
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct ChannelGlobal {
    pub auto_approve: bool,
}
