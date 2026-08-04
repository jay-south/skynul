use std::sync::Arc;

use crate::channels::ChannelRuntime;
use crate::db::DbPool;
use crate::secrets::SecretsStore;

use super::task_stream::TaskStreamHub;
use super::tool_approval::ToolApprovalHub;

#[derive(Clone)]
pub struct AppState {
    pub pool: DbPool,
    pub channels: Arc<ChannelRuntime>,
    pub secrets: Arc<SecretsStore>,
    pub task_streams: Arc<TaskStreamHub>,
    pub tool_approvals: Arc<ToolApprovalHub>,
}
