use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tokio::io::AsyncWriteExt;
use tokio::process::{Child, ChildStdout};
use tokio::sync::Mutex;

// ── Rust → Sidecar (stdin) ────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SidecarInput {
    Init { config: InitConfig },
    Execute { task: TaskInput, provider: ProviderConfig },
    Message { task_id: String, message: String },
    Cancel { task_id: String },
}

#[derive(Debug, Serialize, Default)]
pub struct InitConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub channels: Option<HashMap<String, ChannelInit>>,
}

#[derive(Debug, Serialize)]
pub struct ChannelInit {
    pub enabled: bool,
    pub credentials: HashMap<String, String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskInput {
    pub id: String,
    pub prompt: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub attachments: Option<Vec<String>>,
    pub mode: String,
    pub capabilities: Vec<String>,
    pub max_steps: i64,
    pub timeout_ms: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConfig {
    pub id: String,
    pub model: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
}

// ── Sidecar → Rust (stdout) ───────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SidecarOutput {
    Ready,
    Error {
        message: String,
    },
    TaskUpdate {
        task_id: String,
        status: String,
        #[serde(default)]
        message: Option<String>,
        #[serde(default)]
        step: Option<serde_json::Value>,
        #[serde(default)]
        summary: Option<String>,
    },
    ChannelIncoming {
        source: String,
        chat_id: String,
        text: String,
    },
}

// ── Handle ────────────────────────────────────────────────────────────────────

#[derive(Clone)]
pub struct SidecarHandle {
    stdin: Arc<Mutex<tokio::process::ChildStdin>>,
}

impl SidecarHandle {
    pub async fn send(&self, input: &SidecarInput) -> Result<(), std::io::Error> {
        let mut line = serde_json::to_string(input).expect("serialization cannot fail");
        line.push('\n');
        self.stdin.lock().await.write_all(line.as_bytes()).await
    }
}

// ── Spawn ─────────────────────────────────────────────────────────────────────

pub struct SpawnedSidecar {
    pub handle: SidecarHandle,
    pub child: Child,
    pub stdout: ChildStdout,
}

pub async fn spawn_sidecar(cmd: &str, args: &[&str]) -> Result<SpawnedSidecar, std::io::Error> {
    let mut child = tokio::process::Command::new(cmd)
        .args(args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()?;

    let stdin = child.stdin.take().expect("stdin must be piped");
    let stdout = child.stdout.take().expect("stdout must be piped");

    Ok(SpawnedSidecar {
        handle: SidecarHandle {
            stdin: Arc::new(Mutex::new(stdin)),
        },
        child,
        stdout,
    })
}
