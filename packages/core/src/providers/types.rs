#[derive(Debug, Clone)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Copy)]
pub struct ChatCallOptions {
    pub max_tokens: u32,
    pub timeout_secs: u64,
}

impl ChatCallOptions {
    pub const CLASSIFY: Self = Self {
        max_tokens: 128,
        timeout_secs: 20,
    };

    pub const CONVERSATIONAL: Self = Self {
        max_tokens: 4096,
        timeout_secs: 60,
    };

    pub const AGENT: Self = Self {
        max_tokens: 4096,
        timeout_secs: 120,
    };
}

#[derive(Debug, Clone)]
pub struct LlmContext {
    pub provider_id: String,
    pub model: String,
    pub api_key: Option<String>,
}

impl LlmContext {
    pub fn from_policy(
        provider_id: &str,
        model_override: Option<&str>,
        api_key: Option<String>,
    ) -> Self {
        Self {
            provider_id: provider_id.to_string(),
            model: crate::providers::defaults::resolve_model(provider_id, model_override),
            api_key,
        }
    }
}
