# Providers

Skynul supports multiple providers. Provider selection is stored in the local policy state and used by the main process when handling chat requests.

## How Provider Selection Works

- The active provider is stored as `policy.provider.active`.
- Network chat is blocked unless the `net.http` app capability is enabled.

Provider IDs present in the policy model:

- `chatgpt`, `claude`, `deepseek`, `kimi`, `glm`, `minimax`, `openrouter`, `gemini`

## ChatGPT (OAuth)

ChatGPT uses an OAuth PKCE flow against `https://auth.openai.com`.

- Redirect/callback URL: `http://localhost:1455/auth/callback`
- Tokens are persisted via the secret store under the key `chatgpt.oauth.tokens`.
- A local callback server listens on port `1455` so the redirect URI can be fixed.

## API Key Providers (stored locally)

These providers expect an API key stored in the local secret store (Electron userData):

- `kimi.apiKey`
- `claude.apiKey`
- `deepseek.apiKey`
- `glm.apiKey`
- `minimax.apiKey`
- `openrouter.apiKey`
- `gemini.apiKey`

There is also a separate OpenAI key used for voice transcription:

- `openai.apiKey` (used to call the Whisper transcription endpoint)

## Vision Providers And Supabase

Some vision flows route requests through Supabase Edge Functions that hold upstream API keys.

Main-process vision providers:

- `src/main/providers/claude-vision.ts` calls `${VITE_SUPABASE_URL}/functions/v1/chat-claude`
- `src/main/providers/deepseek-vision.ts` calls `${VITE_SUPABASE_URL}/functions/v1/chat-deepseek`

Supabase functions in this repo:

- `supabase/functions/chat-claude/` (uses `ANTHROPIC_API_KEY` secret)
- `supabase/functions/chat-deepseek/` (uses `DEEPSEEK_API_KEY` secret)
- `supabase/functions/chat-kimi/` (uses `KIMI_API_KEY` secret)
- `supabase/functions/chat/` (uses `OPENAI_API_KEY` secret)

Auth model:

- `chat-claude` and `chat` validate the caller via `supabase.auth.getUser()`.
- `chat-deepseek` currently does not validate the caller token (it explicitly skips auth checks in code).

Renderer configuration:

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are read in the renderer (`src/renderer/src/supabase.ts`).

## Related

- `docs/configuration.md`
