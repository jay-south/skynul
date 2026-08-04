use std::time::Duration;

use futures::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};

use super::types::ChatMessage;

#[derive(Serialize)]
struct ChatRequest {
    model: String,
    max_tokens: u32,
    messages: Vec<ChatMessageReq>,
    #[serde(skip_serializing_if = "Option::is_none")]
    stream: Option<bool>,
}

#[derive(Serialize)]
struct ChatMessageReq {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct StreamChunk {
    choices: Option<Vec<StreamChoice>>,
}

#[derive(Deserialize)]
struct StreamChoice {
    delta: Option<StreamDelta>,
}

#[derive(Deserialize)]
struct StreamDelta {
    content: Option<String>,
    reasoning_content: Option<String>,
}

fn extract_stream_delta(chunk: &StreamChunk) -> Option<String> {
    let delta = chunk.choices.as_ref()?.first()?.delta.as_ref()?;
    if let Some(content) = delta.content.as_ref() {
        if !content.is_empty() {
            return Some(content.clone());
        }
    }
    if let Some(reasoning) = delta.reasoning_content.as_ref() {
        if !reasoning.is_empty() {
            return Some(reasoning.clone());
        }
    }
    None
}

fn map_messages(messages: &[ChatMessage]) -> Vec<ChatMessageReq> {
    let start = messages.len().saturating_sub(20);
    messages[start..]
        .iter()
        .map(|m| ChatMessageReq {
            role: m.role.clone(),
            content: m.content.clone(),
        })
        .collect()
}

pub async fn chat_completion_stream<F>(
    base_url: &str,
    api_key: &str,
    model: &str,
    messages: &[ChatMessage],
    max_tokens: u32,
    timeout_secs: u64,
    mut on_delta: F,
) -> Result<String, String>
where
    F: FnMut(&str),
{
    let client = Client::builder()
        .timeout(Duration::from_secs(timeout_secs))
        .build()
        .map_err(|e| e.to_string())?;

    let body = ChatRequest {
        model: model.to_string(),
        max_tokens,
        messages: map_messages(messages),
        stream: Some(true),
    };

    let url = format!("{}/chat/completions", base_url.trim_end_matches('/'));
    let res = client
        .post(url)
        .header("Authorization", format!("Bearer {api_key}"))
        .json(&body)
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                format!("LLM API timeout ({timeout_secs}s, model={model})")
            } else {
                e.to_string()
            }
        })?;

    if !res.status().is_success() {
        let status = res.status();
        let txt = res.text().await.unwrap_or_default();
        if txt.is_empty() {
            return Err(format!("LLM API error: {status}"));
        }
        return Err(format!("LLM API error: {status} - {txt}"));
    }

    let mut stream = res.bytes_stream();
    let mut buffer = String::new();
    let mut full = String::new();

    while let Some(chunk) = stream.next().await {
        let bytes = chunk.map_err(|e| e.to_string())?;
        buffer.push_str(&String::from_utf8_lossy(&bytes));

        while let Some(newline) = buffer.find('\n') {
            let line = buffer[..newline].trim().to_string();
            buffer = buffer[newline + 1..].to_string();
            if !line.starts_with("data:") {
                continue;
            }
            let data = line.trim_start_matches("data:").trim();
            if data.is_empty() || data == "[DONE]" {
                continue;
            }
            let parsed: StreamChunk = match serde_json::from_str(data) {
                Ok(v) => v,
                Err(_) => continue,
            };
            if let Some(text) = extract_stream_delta(&parsed) {
                full.push_str(&text);
                on_delta(&text);
            }
        }
    }

    let trimmed = full.trim();
    if trimmed.is_empty() {
        return Err("LLM API returned an empty response".to_string());
    }
    Ok(trimmed.to_string())
}
