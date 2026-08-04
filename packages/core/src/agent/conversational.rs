use crate::agent::prompt;
use crate::models::policy::PolicyRecord;
use crate::models::task::Task;
use crate::providers::{dispatch_chat_stream, ChatCallOptions, ChatMessage, LlmContext};
use crate::repo;
use crate::secrets::SecretsStore;

pub async fn respond_with_history<F>(
    task: &Task,
    policy: &PolicyRecord,
    secrets: &SecretsStore,
    mut on_delta: F,
) -> Result<String, String>
where
    F: FnMut(&str),
{
    let llm = LlmContext::from_policy(
        &policy.provider_active,
        policy.provider_model.as_deref(),
        secrets.get(&policy.provider_active),
    );

    let system = prompt::conversational();
    let mut messages = vec![ChatMessage {
        role: "system".to_string(),
        content: system.to_string(),
    }];

    let stored = repo::task::bootstrap_thread(task);

    if stored.is_empty() {
        messages.push(ChatMessage {
            role: "user".to_string(),
            content: task.prompt.clone(),
        });
    } else {
        for value in stored {
            let Some(role) = value.get("role").and_then(|v| v.as_str()) else {
                continue;
            };
            let Some(content) = value.get("content").and_then(|v| v.as_str()) else {
                continue;
            };
            if role == "user" || role == "assistant" {
                messages.push(ChatMessage {
                    role: role.to_string(),
                    content: content.to_string(),
                });
            }
        }
    }

    if messages.len() <= 1 {
        return Err("No user message to respond to.".to_string());
    }

    let text = dispatch_chat_stream(&llm, &messages, ChatCallOptions::CONVERSATIONAL, |chunk| {
        on_delta(chunk);
    })
    .await?;
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Err("El modelo no devolvió una respuesta.".to_string());
    }
    Ok(trimmed.to_string())
}

pub async fn respond<F>(
    prompt: &str,
    policy: &PolicyRecord,
    secrets: &SecretsStore,
    on_delta: F,
) -> Result<String, String>
where
    F: FnMut(&str),
{
    let now = chrono::Utc::now().timestamp_millis();
    let task = Task {
        id: String::new(),
        prompt: prompt.to_string(),
        attachments: None,
        status: "running".to_string(),
        mode: String::new(),
        capabilities: String::new(),
        steps: "[]".to_string(),
        usage: None,
        created_at: now,
        updated_at: now,
        max_steps: 0,
        timeout_ms: 0,
        error: None,
        summary: None,
        source: None,
        source_chat_id: None,
        mode_reasoning: None,
        mode_source: String::new(),
        messages: repo::task::initial_messages_json(prompt, now),
    };
    respond_with_history(&task, policy, secrets, on_delta).await
}
