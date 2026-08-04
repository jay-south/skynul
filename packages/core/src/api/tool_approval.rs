use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use tokio::sync::oneshot;

pub struct ToolApprovalHub {
    pending: Mutex<HashMap<String, oneshot::Sender<bool>>>,
}

impl ToolApprovalHub {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            pending: Mutex::new(HashMap::new()),
        })
    }

    pub fn register(&self, request_id: String) -> oneshot::Receiver<bool> {
        let (tx, rx) = oneshot::channel();
        self.pending
            .lock()
            .expect("tool approval hub lock")
            .insert(request_id, tx);
        rx
    }

    pub fn respond(&self, request_id: &str, approved: bool) -> bool {
        let sender = self
            .pending
            .lock()
            .expect("tool approval hub lock")
            .remove(request_id);
        if let Some(tx) = sender {
            tx.send(approved).is_ok()
        } else {
            false
        }
    }
}
