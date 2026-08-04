mod anthropic_compat;
mod defaults;
mod dispatch;
mod gemini;
mod ollama;
mod openai_compat;
mod tools_compat;
mod types;

pub use defaults::{api_key_error, default_model, resolve_model};
pub use dispatch::{dispatch_chat, dispatch_chat_stream};
pub use tools_compat::{chat_with_tools, openai_base_url, AgentTurn, ToolCall};
pub use types::{ChatCallOptions, ChatMessage, LlmContext};
