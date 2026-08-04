use std::time::Duration;

use reqwest::Client;
use serde::{Deserialize, Serialize};

use super::types::ChatMessage;

const DEFAULT_BASE_URL: &str = "https://generativelanguage.googleapis.com/v1beta";

#[derive(Serialize)]
struct GenerateRequest {
    contents: Vec<GeminiContent>,
}

#[derive(Serialize)]
struct GeminiContent {
    role: String,
    parts: Vec<GeminiPart>,
}

#[derive(Serialize)]
struct GeminiPart {
    text: String,
}

#[derive(Deserialize)]
struct GenerateResponse {
    candidates: Option<Vec<GeminiCandidate>>,
}

#[derive(Deserialize)]
struct GeminiCandidate {
    content: Option<GeminiContentOut>,
}

#[derive(Deserialize)]
struct GeminiContentOut {
    parts: Option<Vec<GeminiPartOut>>,
}

#[derive(Deserialize)]
struct GeminiPartOut {
    text: Option<String>,
}

pub async fn chat_completion(
    api_key: &str,
    model: &str,
    messages: &[ChatMessage],
    timeout_secs: u64,
) -> Result<String, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(timeout_secs))
        .build()
        .map_err(|e| e.to_string())?;

    let start = messages.len().saturating_sub(20);
    let truncated = &messages[start..];

    let contents = truncated
        .iter()
        .map(|m| GeminiContent {
            role: if m.role == "assistant" {
                "model".to_string()
            } else {
                "user".to_string()
            },
            parts: vec![GeminiPart {
                text: m.content.clone(),
            }],
        })
        .collect();

    let base_url = std::env::var("GEMINI_BASE_URL")
        .unwrap_or_else(|_| DEFAULT_BASE_URL.to_string());
    let url = format!(
        "{}/models/{}:generateContent",
        base_url.trim_end_matches('/'),
        model
    );

    let res = client
        .post(url)
        .query(&[("key", api_key)])
        .json(&GenerateRequest { contents })
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

    let data: GenerateResponse = res.json().await.map_err(|e| e.to_string())?;
    let text = data
        .candidates
        .and_then(|c| c.into_iter().next())
        .and_then(|c| c.content)
        .and_then(|c| c.parts)
        .and_then(|p| p.into_iter().next())
        .and_then(|p| p.text)
        .unwrap_or_default()
        .trim()
        .to_string();

    if text.is_empty() {
        return Err("LLM API returned an empty response".to_string());
    }
    Ok(text)
}
