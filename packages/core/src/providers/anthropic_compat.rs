use std::time::Duration;

use reqwest::Client;
use serde::{Deserialize, Serialize};

use super::types::ChatMessage;

#[derive(Serialize)]
struct MessagesRequest {
    model: String,
    max_tokens: u32,
    messages: Vec<AnthropicMessage>,
}

#[derive(Serialize)]
struct AnthropicMessage {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct MessagesResponse {
    content: Option<Vec<ContentBlock>>,
}

#[derive(Deserialize)]
struct ContentBlock {
    #[serde(rename = "type")]
    block_type: Option<String>,
    text: Option<String>,
}

pub async fn chat_completion(
    base_url: &str,
    api_key: &str,
    model: &str,
    messages: &[ChatMessage],
    max_tokens: u32,
    timeout_secs: u64,
) -> Result<String, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(timeout_secs))
        .build()
        .map_err(|e| e.to_string())?;

    let start = messages.len().saturating_sub(20);
    let truncated = &messages[start..];

    let body = MessagesRequest {
        model: model.to_string(),
        max_tokens,
        messages: truncated
            .iter()
            .map(|m| AnthropicMessage {
                role: m.role.clone(),
                content: m.content.clone(),
            })
            .collect(),
    };

    let url = format!("{}/messages", base_url.trim_end_matches('/'));
    let res = client
        .post(url)
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
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

    let data: MessagesResponse = res.json().await.map_err(|e| e.to_string())?;
    let text = data
        .content
        .unwrap_or_default()
        .into_iter()
        .find(|block| block.block_type.as_deref() == Some("text"))
        .and_then(|block| block.text)
        .unwrap_or_default()
        .trim()
        .to_string();

    if text.is_empty() {
        return Err("LLM API returned an empty response".to_string());
    }
    Ok(text)
}
