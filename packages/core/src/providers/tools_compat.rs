use std::time::Duration;

use reqwest::Client;
use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Debug, Clone)]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub arguments: String,
}

#[derive(Debug, Clone)]
pub struct AgentTurn {
    pub content: Option<String>,
    pub tool_calls: Vec<ToolCall>,
}

#[derive(Deserialize)]
struct ChatResponse {
    choices: Option<Vec<Choice>>,
}

#[derive(Deserialize)]
struct Choice {
    message: Option<ResponseMessage>,
}

#[derive(Deserialize)]
struct ResponseMessage {
    content: Option<String>,
    tool_calls: Option<Vec<ResponseToolCall>>,
}

#[derive(Deserialize)]
struct ResponseToolCall {
    id: String,
    function: ResponseFunction,
}

#[derive(Deserialize)]
struct ResponseFunction {
    name: String,
    arguments: String,
}

pub async fn chat_with_tools(
    base_url: &str,
    api_key: &str,
    model: &str,
    messages: &[Value],
    tools: &[Value],
    max_tokens: u32,
    timeout_secs: u64,
) -> Result<AgentTurn, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(timeout_secs))
        .build()
        .map_err(|e| e.to_string())?;

    let body = json!({
        "model": model,
        "max_tokens": max_tokens,
        "messages": messages,
        "tools": tools,
        "tool_choice": "auto",
    });

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

    let data: ChatResponse = res.json().await.map_err(|e| e.to_string())?;
    let message = data
        .choices
        .and_then(|c| c.into_iter().next())
        .and_then(|c| c.message)
        .ok_or_else(|| "LLM API returned no message".to_string())?;

    let tool_calls = message
        .tool_calls
        .unwrap_or_default()
        .into_iter()
        .map(|tc| ToolCall {
            id: tc.id,
            name: tc.function.name,
            arguments: tc.function.arguments,
        })
        .collect();

    Ok(AgentTurn {
        content: message.content.filter(|c| !c.trim().is_empty()),
        tool_calls,
    })
}

pub fn openai_base_url(provider_id: &str) -> Option<&'static str> {
    match provider_id {
        "nvidia" => Some("https://integrate.api.nvidia.com/v1"),
        "chatgpt" => Some("https://api.openai.com/v1"),
        "openrouter" => Some("https://openrouter.ai/api/v1"),
        "deepseek" => Some("https://api.deepseek.com/v1"),
        "glm" => Some("https://open.bigmodel.cn/api/paas/v4"),
        "minimax" => Some("https://api.minimax.chat/v1"),
        _ => None,
    }
}
