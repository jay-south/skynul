use super::anthropic_compat;
use super::defaults;
use super::gemini;
use super::ollama;
use super::openai_compat;
use super::types::{ChatCallOptions, ChatMessage, LlmContext};

enum ProviderBackend {
    OpenAi { base_url: &'static str },
    Anthropic { base_url: &'static str },
    Gemini,
    Ollama,
}

fn backend_for(provider_id: &str) -> Option<ProviderBackend> {
    match provider_id {
        "nvidia" => Some(ProviderBackend::OpenAi {
            base_url: "https://integrate.api.nvidia.com/v1",
        }),
        "chatgpt" => Some(ProviderBackend::OpenAi {
            base_url: "https://api.openai.com/v1",
        }),
        "openrouter" => Some(ProviderBackend::OpenAi {
            base_url: "https://openrouter.ai/api/v1",
        }),
        "deepseek" => Some(ProviderBackend::OpenAi {
            base_url: "https://api.deepseek.com/v1",
        }),
        "glm" => Some(ProviderBackend::OpenAi {
            base_url: "https://open.bigmodel.cn/api/paas/v4",
        }),
        "minimax" => Some(ProviderBackend::OpenAi {
            base_url: "https://api.minimax.chat/v1",
        }),
        "claude" => Some(ProviderBackend::Anthropic {
            base_url: "https://api.anthropic.com/v1",
        }),
        "kimi" => Some(ProviderBackend::Anthropic {
            base_url: "https://api.kimi.com/coding/v1",
        }),
        "gemini" => Some(ProviderBackend::Gemini),
        "ollama" => Some(ProviderBackend::Ollama),
        _ => None,
    }
}

pub async fn dispatch_chat(
    ctx: &LlmContext,
    messages: &[ChatMessage],
    options: ChatCallOptions,
) -> Result<String, String> {
    dispatch_chat_stream(ctx, messages, options, |_| {}).await
}

pub async fn dispatch_chat_stream<F>(
    ctx: &LlmContext,
    messages: &[ChatMessage],
    options: ChatCallOptions,
    mut on_delta: F,
) -> Result<String, String>
where
    F: FnMut(&str),
{
    let backend = backend_for(&ctx.provider_id).ok_or_else(|| {
        format!("Unknown provider: {}", ctx.provider_id)
    })?;

    match backend {
        ProviderBackend::Ollama => {
            let text = ollama::chat_completion(&ctx.model, messages, options.timeout_secs).await?;
            on_delta(&text);
            Ok(text)
        }
        ProviderBackend::Gemini => {
            let api_key = ctx
                .api_key
                .as_deref()
                .ok_or_else(|| defaults::api_key_error(&ctx.provider_id))?;
            let text =
                gemini::chat_completion(api_key, &ctx.model, messages, options.timeout_secs).await?;
            on_delta(&text);
            Ok(text)
        }
        ProviderBackend::OpenAi { base_url } => {
            let api_key = ctx
                .api_key
                .as_deref()
                .ok_or_else(|| defaults::api_key_error(&ctx.provider_id))?;
            openai_compat::chat_completion_stream(
                base_url,
                api_key,
                &ctx.model,
                messages,
                options.max_tokens,
                options.timeout_secs,
                on_delta,
            )
            .await
        }
        ProviderBackend::Anthropic { base_url } => {
            let api_key = ctx
                .api_key
                .as_deref()
                .ok_or_else(|| defaults::api_key_error(&ctx.provider_id))?;
            let text = anthropic_compat::chat_completion(
                base_url,
                api_key,
                &ctx.model,
                messages,
                options.max_tokens,
                options.timeout_secs,
            )
            .await?;
            on_delta(&text);
            Ok(text)
        }
    }
}
