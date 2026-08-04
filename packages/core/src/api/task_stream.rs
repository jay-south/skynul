use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use tokio::sync::broadcast;

use crate::api::types::TaskStreamEvent;

const BROADCAST_CAP: usize = 64;

pub struct TaskStreamHub {
    channels: Mutex<HashMap<String, broadcast::Sender<String>>>,
}

impl TaskStreamHub {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            channels: Mutex::new(HashMap::new()),
        })
    }

    pub fn subscribe(&self, task_id: &str) -> broadcast::Receiver<String> {
        let mut channels = self.channels.lock().expect("task stream hub lock");
        let sender = channels
            .entry(task_id.to_string())
            .or_insert_with(|| broadcast::channel(BROADCAST_CAP).0);
        sender.subscribe()
    }

    pub fn emit(&self, task_id: &str, event: TaskStreamEvent) {
        let payload = match serde_json::to_string(&event) {
            Ok(json) => json,
            Err(e) => {
                tracing::warn!(task_id = %task_id, error = %e, "task stream: serialize failed");
                return;
            }
        };
        let channels = self.channels.lock().expect("task stream hub lock");
        if let Some(sender) = channels.get(task_id) {
            let _ = sender.send(payload);
        }
    }

    pub fn emit_status(&self, task_id: &str, status: &str) {
        self.emit(
            task_id,
            TaskStreamEvent::StatusChange {
                status: status.to_string(),
            },
        );
    }

    pub fn emit_delta(&self, task_id: &str, text: &str) {
        if text.is_empty() {
            return;
        }
        self.emit(
            task_id,
            TaskStreamEvent::Delta {
                text: text.to_string(),
            },
        );
    }

    pub fn emit_message(&self, task_id: &str, text: &str) {
        self.emit(
            task_id,
            TaskStreamEvent::Message {
                text: text.to_string(),
            },
        );
    }

    pub fn emit_step(&self, task_id: &str, tool: &str, label: &str, ok: bool) {
        self.emit(
            task_id,
            TaskStreamEvent::Step {
                tool: tool.to_string(),
                label: label.to_string(),
                ok,
            },
        );
    }

    pub fn emit_permission_request(
        &self,
        task_id: &str,
        request_id: &str,
        tool: &str,
        label: &str,
    ) {
        self.emit(
            task_id,
            TaskStreamEvent::PermissionRequest {
                request_id: request_id.to_string(),
                tool: tool.to_string(),
                label: label.to_string(),
            },
        );
    }

    pub fn emit_error(&self, task_id: &str, message: &str) {
        self.emit(
            task_id,
            TaskStreamEvent::Error {
                message: message.to_string(),
            },
        );
    }

    pub fn emit_done(&self, task_id: &str) {
        self.emit(task_id, TaskStreamEvent::Done);
    }

    pub fn emit_terminal(&self, task: &crate::models::task::Task) {
        match task.status.as_str() {
            "completed" => {
                if let Some(summary) = task.summary.as_deref().filter(|s| !s.is_empty()) {
                    self.emit_message(&task.id, summary);
                }
                self.emit_done(&task.id);
            }
            "failed" => {
                let message = task
                    .error
                    .as_deref()
                    .unwrap_or("No pude completar esta tarea.");
                self.emit_error(&task.id, message);
                self.emit_done(&task.id);
            }
            "cancelled" => {
                self.emit_status(&task.id, "cancelled");
                self.emit_done(&task.id);
            }
            _ => {}
        }
    }
}
