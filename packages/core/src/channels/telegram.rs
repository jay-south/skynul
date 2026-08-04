use std::sync::Arc;
use std::time::Duration;

use serde::Deserialize;
use serde_json::{json, Map, Value};
use tokio::task::JoinHandle;

use crate::db::get_conn;
use crate::repo;

use super::runtime::ChannelRuntime;

pub fn spawn(runtime: Arc<ChannelRuntime>) -> JoinHandle<()> {
    tokio::spawn(async move {
        let mut offset: i64 = 0;
        loop {
            let config = match load_config(&runtime.pool).await {
                Some(c) => c,
                None => {
                    tokio::time::sleep(Duration::from_secs(5)).await;
                    continue;
                }
            };

            match poll_once(&runtime, &config, &mut offset).await {
                Ok(()) => {}
                Err(e) => {
                    tracing::warn!("telegram: poll error: {e}");
                    let _ = get_conn(&runtime.pool).and_then(|mut c| {
                        repo::channel::set_status(&mut c, "telegram", "error", Some(&e))
                    });
                    tokio::time::sleep(Duration::from_secs(30)).await;
                }
            }
        }
    })
}

struct TelegramConfig {
    token: String,
    paired_chat_id: Option<i64>,
    pairing_code: Option<String>,
}

async fn load_config(pool: &crate::db::DbPool) -> Option<TelegramConfig> {
    let mut conn = get_conn(pool).ok()?;
    let channel = repo::channel::get(&mut conn, "telegram").ok()?;
    if !channel.enabled || !channel.has_credentials {
        return None;
    }

    let meta: Map<String, Value> = serde_json::from_str(&channel.meta).unwrap_or_default();
    let token = meta
        .get("token")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())?
        .to_string();
    let paired_chat_id = meta.get("pairedChatId").and_then(|v| v.as_i64());

    Some(TelegramConfig {
        token,
        paired_chat_id,
        pairing_code: channel.pairing_code,
    })
}

async fn poll_once(
    runtime: &Arc<ChannelRuntime>,
    config: &TelegramConfig,
    offset: &mut i64,
) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(35))
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!(
        "https://api.telegram.org/bot{}/getUpdates",
        config.token
    );
    let resp = client
        .get(&url)
        .query(&[("offset", offset.to_string()), ("timeout", "30".into())])
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("getUpdates HTTP {}", resp.status()));
    }

    let body: UpdatesResponse = resp.json().await.map_err(|e| e.to_string())?;
    if !body.ok {
        return Err("getUpdates returned ok=false".into());
    }

    let _ = get_conn(&runtime.pool).and_then(|mut c| {
        repo::channel::set_status(&mut c, "telegram", "connected", None)
    });

    for update in body.result {
        if let Some(id) = update.update_id {
            *offset = id + 1;
        }
        if let Some(msg) = update.message {
            handle_message(runtime, config, msg).await;
        }
    }
    Ok(())
}

async fn handle_message(runtime: &Arc<ChannelRuntime>, config: &TelegramConfig, msg: TelegramMessage) {
    let Some(chat_id) = msg.chat.as_ref().and_then(|c| c.id) else {
        return;
    };
    let Some(text) = msg.text.as_deref().map(str::trim).filter(|s| !s.is_empty()) else {
        return;
    };

    if text.starts_with("/pair") {
        handle_pair(runtime, config, chat_id, text).await;
        return;
    }

    if text == "/unpair" {
        if config.paired_chat_id == Some(chat_id) {
            let _ = get_conn(&runtime.pool).and_then(|mut c| repo::channel::unpair(&mut c, "telegram"));
            send_text(&config.token, chat_id, "Desvinculado.").await;
        }
        return;
    }

    if config.paired_chat_id != Some(chat_id) {
        send_text(
            &config.token,
            chat_id,
            "No estás vinculado. Usá /pair <código> primero.",
        )
        .await;
        return;
    }

    runtime
        .spawn_task_from_message("telegram".into(), chat_id, text.to_string());
    send_text(&config.token, chat_id, "Recibido, procesando...").await;
}

async fn handle_pair(
    runtime: &Arc<ChannelRuntime>,
    config: &TelegramConfig,
    chat_id: i64,
    text: &str,
) {
    let code = text.strip_prefix("/pair").map(str::trim).unwrap_or("");
    if code.is_empty() {
        send_text(&config.token, chat_id, "Uso: /pair <código>").await;
        return;
    }
    let Some(expected) = config.pairing_code.as_deref() else {
        send_text(
            &config.token,
            chat_id,
            "No hay código activo. Generá uno desde Skynul.",
        )
        .await;
        return;
    };
    if code != expected {
        send_text(&config.token, chat_id, "Código inválido.").await;
        return;
    }

    match get_conn(&runtime.pool).and_then(|mut c| repo::channel::confirm_pairing(&mut c, "telegram", chat_id))
    {
        Ok(()) => {
            send_text(
                &config.token,
                chat_id,
                "✅ Vinculado! Mandame un mensaje para crear una tarea.",
            )
            .await;
            runtime.reload("telegram").await;
        }
        Err(e) => {
            send_text(&config.token, chat_id, &format!("Error al vincular: {e}")).await;
        }
    }
}

pub async fn send_message(pool: &crate::db::DbPool, chat_id: i64, text: &str) {
    let Some(token) = load_token(pool).await else {
        tracing::warn!("telegram: send skipped, no token");
        return;
    };
    send_text(&token, chat_id, text).await;
}

async fn load_token(pool: &crate::db::DbPool) -> Option<String> {
    let mut conn = get_conn(pool).ok()?;
    let channel = repo::channel::get(&mut conn, "telegram").ok()?;
    let meta: Map<String, Value> = serde_json::from_str(&channel.meta).unwrap_or_default();
    meta.get("token")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
}

async fn send_text(token: &str, chat_id: i64, text: &str) {
    let client = match reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("telegram: client: {e}");
            return;
        }
    };
    let url = format!("https://api.telegram.org/bot{token}/sendMessage");
    let resp = client
        .post(&url)
        .json(&json!({ "chat_id": chat_id, "text": text }))
        .send()
        .await;
    if let Err(e) = resp {
        tracing::error!("telegram: send failed: {e}");
    }
}

#[derive(Debug, Deserialize)]
struct UpdatesResponse {
    ok: bool,
    result: Vec<TelegramUpdate>,
}

#[derive(Debug, Deserialize)]
struct TelegramUpdate {
    update_id: Option<i64>,
    message: Option<TelegramMessage>,
}

#[derive(Debug, Deserialize)]
struct TelegramMessage {
    text: Option<String>,
    chat: Option<TelegramChat>,
}

#[derive(Debug, Deserialize)]
struct TelegramChat {
    id: Option<i64>,
}
