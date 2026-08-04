use serde::{Deserialize, Serialize};
use serde_json::Value;
use typeshare::typeshare;

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TaskStatus {
    Planning,
    Pending,
    Running,
    Completed,
    Failed,
    Cancelled,
}

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TaskMode {
    Agent,
}

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ModeSource {
    Inferred,
    Manual,
}

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TaskSource {
    Desktop,
    Telegram,
    Discord,
    Slack,
    Whatsapp,
    Signal,
}

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskStepResponse {
    pub tool: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub arguments: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskMessageResponse {
    pub role: String,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub steps: Option<Vec<TaskStepResponse>>,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<bool>,
}

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskResponse {
    pub id: String,
    pub status: String,
    pub prompt: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub steps: Option<Vec<TaskStepResponse>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub messages: Option<Vec<TaskMessageResponse>>,
}

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskCreateRequest {
    pub prompt: String,
    pub attachments: Option<Vec<String>>,
    pub mode: Option<String>,
}

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskContinueRequest {
    pub prompt: String,
    pub attachments: Option<Vec<String>>,
}

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskCreatedResponse {
    pub id: String,
    pub status: String,
}

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskCancelResponse {
    pub id: String,
    pub status: String,
}

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskListResponse {
    pub items: Vec<TaskResponse>,
    #[typeshare(serialized_as = "number")]
    pub total: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event", rename_all = "snake_case")]
pub enum TaskStreamEvent {
    StatusChange { status: String },
    Delta { text: String },
    Message { text: String },
    Step {
        tool: String,
        label: String,
        ok: bool,
    },
    PermissionRequest {
        request_id: String,
        tool: String,
        label: String,
    },
    Error { message: String },
    Done,
}

#[typeshare]
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum PermissionLevel {
    Deny,
    Ask,
    Allow,
}

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum CapabilityId {
    #[serde(rename = "fs.read")]
    FsRead,
    #[serde(rename = "fs.write")]
    FsWrite,
    #[serde(rename = "cmd.run")]
    CmdRun,
    #[serde(rename = "net.http")]
    NetHttp,
}

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum LanguageCode {
    #[serde(rename = "en")]
    En,
    #[serde(rename = "es")]
    Es,
}

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ThemeMode {
    System,
    Light,
    Dark,
    Midnight,
    Forest,
}

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ProviderId {
    #[serde(rename = "chatgpt")]
    Chatgpt,
    #[serde(rename = "claude")]
    Claude,
    #[serde(rename = "deepseek")]
    Deepseek,
    #[serde(rename = "kimi")]
    Kimi,
    #[serde(rename = "glm")]
    Glm,
    #[serde(rename = "minimax")]
    Minimax,
    #[serde(rename = "openrouter")]
    Openrouter,
    #[serde(rename = "gemini")]
    Gemini,
    #[serde(rename = "nvidia")]
    Nvidia,
    #[serde(rename = "ollama")]
    Ollama,
}

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeneralSettings {
    pub language: String,
    pub theme_mode: String,
    pub agent_prompt_append: String,
}

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionsSettings {
    pub fs_read: PermissionLevel,
    pub fs_write: PermissionLevel,
    pub cmd_run: PermissionLevel,
    pub net_http: PermissionLevel,
}

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderSummary {
    pub id: String,
    pub configured: bool,
}

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelSettings {
    pub active_provider: String,
    pub model: Option<String>,
    pub providers: Vec<ProviderSummary>,
}

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PatchGeneralSettings {
    pub language: Option<String>,
    pub theme_mode: Option<String>,
    pub agent_prompt_append: Option<String>,
}

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PatchPermissionsSettings {
    pub fs_read: Option<PermissionLevel>,
    pub fs_write: Option<PermissionLevel>,
    pub cmd_run: Option<PermissionLevel>,
    pub net_http: Option<PermissionLevel>,
}

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolApprovalRequest {
    pub request_id: String,
    pub approved: bool,
}

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PatchModelSettings {
    pub active_provider: Option<String>,
    pub model: Option<String>,
}

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PutProviderCredentials {
    pub api_key: String,
}

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ChannelId {
    #[serde(rename = "telegram")]
    Telegram,
    #[serde(rename = "whatsapp")]
    Whatsapp,
    #[serde(rename = "discord")]
    Discord,
    #[serde(rename = "signal")]
    Signal,
    #[serde(rename = "slack")]
    Slack,
}

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ChannelStatus {
    Disconnected,
    Connecting,
    Connected,
    Error,
}

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelSettings {
    pub id: String,
    pub enabled: bool,
    pub status: String,
    pub paired: bool,
    pub pairing_code: Option<String>,
    pub error: Option<String>,
    pub has_credentials: bool,
    #[typeshare(typescript(type = "Record<string, unknown>"))]
    pub meta: Value,
}

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelListResponse {
    pub channels: Vec<ChannelSettings>,
}

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingCodeResponse {
    pub code: String,
}

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub color: String,
    #[typeshare(serialized_as = "number")]
    pub created_at: i64,
}

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSummary {
    pub id: String,
    pub name: String,
    pub color: String,
    pub task_count: i32,
}

#[typeshare]
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectRequest {
    pub name: String,
    pub color: Option<String>,
}

#[typeshare]
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PatchProjectRequest {
    pub name: Option<String>,
    pub color: Option<String>,
}

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderListItem {
    pub id: String,
    pub name: String,
    pub configured: bool,
}

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddTaskToProjectRequest {
    pub task_id: String,
}

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ScheduleFrequency {
    Daily,
    Weekly,
    Custom,
}

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Schedule {
    pub id: String,
    pub prompt: String,
    pub frequency: String,
    pub cron_expr: String,
    pub enabled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[typeshare(serialized_as = "number")]
    pub last_run_at: Option<i64>,
    #[typeshare(serialized_as = "number")]
    pub next_run_at: i64,
    #[typeshare(serialized_as = "number")]
    pub created_at: i64,
}

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleListResponse {
    pub schedules: Vec<Schedule>,
}

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeAppStats {
    pub cpu_percent: f64,
    pub memory_mb: f64,
    pub process_count: i32,
}

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeSystemStats {
    pub total_mem_mb: f64,
    pub free_mem_mb: f64,
    pub loadavg1m: f64,
}

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeStats {
    #[typeshare(serialized_as = "number")]
    pub ts: i64,
    pub app: RuntimeAppStats,
    pub system: RuntimeSystemStats,
}

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OkResponse {
    pub ok: bool,
}
