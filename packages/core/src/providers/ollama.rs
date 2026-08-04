use std::time::Duration;

use reqwest::Client;
use serde::{Deserialize, Serialize};

use super::types::ChatMessage;

const DEFAULT_BASE_URL: &str = "http://localhost:11434";

#[derive(Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessageReq>,
    stream: bool,
}

#[derive(Serialize)]
struct ChatMessageReq {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct ChatResponse {
    message: Option<ChatMessageOut>,
}

#[derive(Deserialize)]
struct ChatMessageOut {
    content: Option<String>,
}

pub async fn chat_completion(
    model: &str,
    messages: &[ChatMessage],
    timeout_secs: u64,
) -> Result<String, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(timeout_secs))
        .build()
        .map_err(|e| e.to_string())?;

    let base_url = std::env::var("OLLAMA_BASE_URL")
        .unwrap_or_else(|_| DEFAULT_BASE_URL.to_string());
    let start = messages.len().saturating_sub(20);
    let truncated = &messages[start..];

    let body = ChatRequest {
        model: model.to_string(),
        messages: truncated
            .iter()
            .map(|m| ChatMessageReq {
                role: m.role.clone(),
                content: m.content.clone(),
            })
            .collect(),
        stream: false,
    };

    let url = format!("{}/api/chat", base_url.trim_end_matches('/'));
    let res = client
        .post(url)
        .json(&body)
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                format!("Ollama timeout ({timeout_secs}s, model={model})")
            } else {
                e.to_string()
            }
        })?;

    if !res.status().is_success() {
        let status = res.status();
        let txt = res.text().await.unwrap_or_default();
        if txt.is_empty() {
            return Err(format!("Ollama error: {status}"));
        }
        return Err(format!("Ollama error: {status} - {txt}"));
    }

    let data: ChatResponse = res.json().await.map_err(|e| e.to_string())?;
    let text = data
        .message
        .and_then(|m| m.content)
        .unwrap_or_default()
        .trim()
        .to_string();

    if text.is_empty() {
        return Err("Ollama returned an empty response".to_string());
    }
    Ok(text)
}
