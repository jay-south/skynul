pub fn resolve_model(provider_id: &str, model_override: Option<&str>) -> String {
    if let Some(model) = model_override {
        let trimmed = model.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }
    default_model(provider_id).to_string()
}

pub fn default_model(provider_id: &str) -> &'static str {
    match provider_id {
        "nvidia" => "meta/llama-3.1-8b-instruct",
        "chatgpt" => "gpt-4.1-mini",
        "openrouter" => "openrouter/auto",
        "deepseek" => "deepseek-chat",
        "glm" => "glm-4-plus",
        "minimax" => "MiniMax-M2.5",
        "claude" => "claude-sonnet-4-20250514",
        "kimi" => "kimi-for-coding",
        "gemini" => "gemini-2.0-flash",
        "ollama" => "qwen3.5:27b",
        _ => "gpt-4.1-mini",
    }
}

pub fn api_key_error(provider_id: &str) -> String {
    format!("API key not set for provider '{provider_id}'. Add it in Settings → Model.")
}
