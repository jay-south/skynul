use std::sync::Arc;
use std::time::{Duration, Instant};

use serde_json::json;

use crate::api::TaskStreamHub;
use crate::api::ToolApprovalHub;
use crate::db::{get_conn, DbPool};
use crate::models::policy::PolicyRecord;
use crate::models::task::Task;
use crate::policy::{ParsedPolicy, PermissionLevel};
use crate::providers::{api_key_error, chat_with_tools, openai_base_url, LlmContext, ToolCall};
use crate::repo;
use crate::secrets::SecretsStore;

use super::doom::DoomLoopGuard;
use super::tools::{self, ToolName};
use crate::agent::prompt::{build_agent_system, PromptContext};

pub struct HarnessDeps {
    pub pool: DbPool,
    pub policy: PolicyRecord,
    pub secrets: Arc<SecretsStore>,
    pub streams: Arc<TaskStreamHub>,
    pub tool_approvals: Arc<ToolApprovalHub>,
    pub task_id: String,
}

pub async fn run(task: Task, deps: HarnessDeps) -> Result<(), String> {
    let llm = LlmContext::from_policy(
        &deps.policy.provider_active,
        deps.policy.provider_model.as_deref(),
        deps.secrets.get(&deps.policy.provider_active),
    );

    let base_url = openai_base_url(&llm.provider_id)
        .ok_or_else(|| format!("Provider {} does not support tool-calling yet.", llm.provider_id))?;
    let api_key = llm
        .api_key
        .as_deref()
        .ok_or_else(|| api_key_error(&llm.provider_id))?;

    let parsed = ParsedPolicy::from_record(&deps.policy);
    let env = runtime_env();
    let tool_defs = tools::openai_definitions();
    let system = build_agent_system(&PromptContext {
        append: deps.policy.agent_prompt_append.clone(),
    });

    let mut messages = build_harness_messages(&task, &env, &system);

    let max_steps = task.max_steps.max(1) as usize;
    let deadline = Instant::now() + Duration::from_millis(task.timeout_ms.max(1) as u64);
    let mut doom = DoomLoopGuard::new();
    let mut step_index = serde_json::from_str::<Vec<serde_json::Value>>(&task.steps)
        .map(|v| v.len())
        .unwrap_or(0);

    for _ in 0..max_steps {
        if Instant::now() >= deadline {
            return fail_task(&deps.pool, &deps.task_id, "Task timed out").await;
        }

        tracing::info!(task_id = %task.id, step = step_index + 1, "harness: llm call");

        let turn = chat_with_tools(
            base_url,
            api_key,
            &llm.model,
            &messages,
            &tool_defs,
            4096,
            120,
        )
        .await
        .map_err(|e| format!("LLM error: {e}"))?;

        if turn.tool_calls.is_empty() {
            let summary = turn
                .content
                .filter(|c| !c.trim().is_empty())
                .ok_or_else(|| "Agent finished without a response.".to_string())?;
            return complete_task(&deps.pool, &deps.task_id, summary).await;
        }

        let assistant_msg = assistant_message(&turn.content, &turn.tool_calls);
        messages.push(assistant_msg);

        for call in turn.tool_calls {
            let (result, error) = execute_call(&call, &parsed, &mut doom, &deps).await;
            let step = build_step_json(step_index, &call, result.as_deref(), error.as_deref());
            push_step(&deps.pool, &deps.task_id, step).await?;
            deps.streams.emit_step(
                &deps.task_id,
                &call.name,
                &step_label(&call),
                error.is_none(),
            );
            step_index += 1;

            let has_error = error.is_some();
            messages.push(json!({
                "role": "tool",
                "tool_call_id": call.id,
                "content": result.unwrap_or_else(|| error.unwrap_or_else(|| "unknown error".into()))
            }));

            tracing::info!(
                task_id = %task.id,
                tool = %call.name,
                has_error = has_error,
                "harness: tool done"
            );
        }

        compact_messages(&mut messages);
    }

    fail_task(
        &deps.pool,
        &deps.task_id,
        &format!("Reached max steps ({max_steps})"),
    )
    .await
}

async fn execute_call(
    call: &ToolCall,
    policy: &ParsedPolicy,
    doom: &mut DoomLoopGuard,
    deps: &HarnessDeps,
) -> (Option<String>, Option<String>) {
    let Some(tool) = ToolName::parse(&call.name) else {
        return (
            None,
            Some(format!("Unknown tool: {}", call.name)),
        );
    };

    if let Err(e) = tools::check_permission(tool, policy) {
        return (None, Some(e));
    }

    if tools::requires_confirmation(tool) {
        for gate in tool.required_gates() {
            if policy.level(gate) == PermissionLevel::Ask {
                let label = step_label(call);
                let request_id = uuid::Uuid::new_v4().to_string();
                deps.streams.emit_permission_request(
                    &deps.task_id,
                    &request_id,
                    &call.name,
                    &label,
                );
                let rx = deps.tool_approvals.register(request_id);
                let approved = match tokio::time::timeout(Duration::from_secs(300), rx).await {
                    Ok(Ok(value)) => value,
                    _ => false,
                };
                if !approved {
                    return (
                        None,
                        Some("Acción rechazada. Cambiá el enfoque o pedile al usuario que apruebe.".into()),
                    );
                }
                break;
            }
        }
    }

    if doom.observe(&call.name, &call.arguments) {
        return (
            None,
            Some("doom_loop: same tool call repeated 3 times. Change approach or finish with a summary.".into()),
        );
    }

    let args: serde_json::Value = match serde_json::from_str(&call.arguments) {
        Ok(v) => v,
        Err(e) => return (None, Some(format!("Invalid tool arguments JSON: {e}"))),
    };

    match tools::execute(tool, &args).await {
        Ok(out) => (Some(out), None),
        Err(e) => (None, Some(e)),
    }
}

fn step_label(call: &ToolCall) -> String {
    let args: serde_json::Value = serde_json::from_str(&call.arguments).unwrap_or(json!({}));
    match call.name.as_str() {
        "bash" => args
            .get("command")
            .and_then(|v| v.as_str())
            .unwrap_or("?")
            .chars()
            .take(80)
            .collect(),
        "ls" => args
            .get("path")
            .and_then(|v| v.as_str())
            .unwrap_or(".")
            .to_string(),
        "read" | "write" | "edit" | "find" | "glob" | "grep" | "fetch" => {
            let path = args
                .get("path")
                .and_then(|v| v.as_str())
                .unwrap_or(".");
            if call.name == "find" || call.name == "glob" {
                let pattern = args
                    .get("pattern")
                    .and_then(|v| v.as_str())
                    .unwrap_or("*");
                format!("{pattern} in {path}")
            } else if call.name == "grep" {
                let pattern = args
                    .get("pattern")
                    .and_then(|v| v.as_str())
                    .unwrap_or("?");
                format!("'{pattern}' in {path}")
            } else if call.name == "fetch" {
                args.get("url")
                    .and_then(|v| v.as_str())
                    .unwrap_or("?")
                    .chars()
                    .take(80)
                    .collect()
            } else {
                path.to_string()
            }
        }
        _ => call.arguments.chars().take(60).collect(),
    }
}

fn assistant_message(content: &Option<String>, calls: &[ToolCall]) -> serde_json::Value {
    let tool_calls: Vec<serde_json::Value> = calls
        .iter()
        .map(|c| {
            json!({
                "id": c.id,
                "type": "function",
                "function": {
                    "name": c.name,
                    "arguments": c.arguments
                }
            })
        })
        .collect();

    json!({
        "role": "assistant",
        "content": content.as_deref().unwrap_or(""),
        "tool_calls": tool_calls
    })
}

fn build_step_json(
    index: usize,
    call: &ToolCall,
    result: Option<&str>,
    error: Option<&str>,
) -> serde_json::Value {
    let mut step = json!({
        "index": index,
        "timestamp": chrono::Utc::now().timestamp_millis(),
        "tool": call.name,
        "arguments": call.arguments,
    });
    if let Some(r) = result {
        step["result"] = json!(r);
    }
    if let Some(e) = error {
        step["error"] = json!(e);
    }
    step
}

fn build_harness_messages(task: &Task, env: &str, system: &str) -> Vec<serde_json::Value> {
    let stored = repo::task::bootstrap_thread(task);
    let mut messages = vec![json!({ "role": "system", "content": system })];

    if stored.is_empty() {
        messages.push(json!({
            "role": "user",
            "content": format!("{env}\n\nTask:\n{}", task.prompt)
        }));
        return messages;
    }

    for (index, value) in stored.iter().enumerate() {
        let Some(role) = value.get("role").and_then(|v| v.as_str()) else {
            continue;
        };
        let Some(content) = value.get("content").and_then(|v| v.as_str()) else {
            continue;
        };
        if role == "assistant" {
            messages.push(json!({ "role": "assistant", "content": content }));
            continue;
        }
        if role != "user" {
            continue;
        }
        let is_last_user = stored[index..]
            .iter()
            .filter(|m| m.get("role").and_then(|v| v.as_str()) == Some("user"))
            .count()
            == 1;
        let body = if is_last_user {
            format!("{env}\n\nTask:\n{content}")
        } else {
            content.to_string()
        };
        messages.push(json!({ "role": "user", "content": body }));
    }

    messages
}

fn compact_messages(messages: &mut Vec<serde_json::Value>) {
    const MAX: usize = 24;
    const KEEP_RECENT: usize = 12;
    if messages.len() <= MAX {
        return;
    }

    let system = messages.first().cloned();
    let compact_end = messages.len().saturating_sub(KEEP_RECENT);
    if compact_end <= 1 {
        return;
    }

    let mut summary_lines = Vec::new();
    for msg in &messages[1..compact_end] {
        let role = msg.get("role").and_then(|v| v.as_str()).unwrap_or("?");
        let content = msg.get("content").and_then(|v| v.as_str()).unwrap_or("");
        let preview: String = content.chars().take(160).collect();
        if !preview.is_empty() {
            summary_lines.push(format!("{role}: {preview}"));
        }
    }

    let compact = json!({
        "role": "user",
        "content": format!(
            "[Earlier conversation compacted — {} messages omitted]\n{}",
            compact_end - 1,
            summary_lines.join("\n")
        )
    });

    let recent = messages[compact_end..].to_vec();
    messages.clear();
    if let Some(sys) = system {
        messages.push(sys);
    }
    messages.push(compact);
    messages.extend(recent);
}

fn runtime_env() -> String {
    use super::exec;

    let home = exec::tool_base_dir().display().to_string();
    let documents = exec::documents_dir().display().to_string();
    format!("Environment: HOME={home}, DOCUMENTS={documents}")
}

async fn push_step(pool: &DbPool, task_id: &str, step: serde_json::Value) -> Result<(), String> {
    let mut conn = get_conn(pool).map_err(|e| e.to_string())?;
    repo::task::apply_task_update(&mut conn, task_id, "running", Some(step), None, None)
        .map_err(|e| e.to_string())?;
    Ok(())
}

async fn complete_task(pool: &DbPool, task_id: &str, summary: String) -> Result<(), String> {
    let mut conn = get_conn(pool).map_err(|e| e.to_string())?;
    repo::task::finalize_turn(&mut conn, task_id, "completed", Some(summary), None)
        .map_err(|e| e.to_string())?;
    Ok(())
}

async fn fail_task(pool: &DbPool, task_id: &str, reason: &str) -> Result<(), String> {
    let mut conn = get_conn(pool).map_err(|e| e.to_string())?;
    repo::task::fail_task(&mut conn, task_id, reason).map_err(|e| e.to_string())?;
    Ok(())
}
