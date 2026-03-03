# Design: Fix Chat Thinking Indicator UX

## Technical Approach

The implementation leverages the existing `task.summary` field to provide descriptive initialization messages before the first AI provider response. The approach is minimal and non-breaking:

1. **In `task-runner.ts`**: Add `pushStatus()` calls at key initialization entry points in both `runCdp()` and `runCode()` methods to set user-friendly status messages that include the provider name.

2. **In `ChatFeed.tsx`**: The existing logic already displays `task.summary` when available (line 160), falling back to "Thinking...". No changes needed to the UI component.

3. **Clear on first step**: The `task.summary` is naturally cleared/overwritten when the first step arrives because the agent loop replaces it with step content. At task completion, `task.summary` is set to the final summary by the `done` action handler.

## Architecture Decisions

### Decision: Provider Name Display

**Choice**: Capitalize the provider ID for display (e.g., 'kimi' → 'Kimi', 'claude' → 'Claude')

**Alternatives considered**:

- Create a provider name mapping object: `{ kimi: 'Kimi', claude: 'Claude', ... }`
- Pass display names from policy or provider modules

**Rationale**:

- Provider IDs are already semantic ('kimi', 'claude', 'deepseek', 'chatgpt')
- Simple capitalization provides good UX without adding maintenance overhead
- No additional imports or dependencies needed
- Easy to extend when new providers are added

### Decision: Status Message Location

**Choice**: Set status messages at the very beginning of `runCdp()` and `runCode()` methods, before any async operations that could fail

**Alternatives considered**:

- Set messages in task-manager before calling runner
- Set messages inside provider-specific callVisionModel

**Rationale**:

- Task-runner has access to `this.opts.provider` directly
- Keeps initialization UX logic co-located with the initialization code
- Allows for mode-specific messages (CDP vs Code)
- Messages appear immediately when the runner starts, before any potential errors

### Decision: Error Handling Strategy

**Choice**: Set the status message BEFORE any validation that could throw (API key checks, etc.)

**Alternatives considered**:

- Set message after validation passes
- Use try/catch to suppress messages on immediate errors

**Rationale**:

- If API key is missing, the error will replace the status message immediately
- User sees "Connecting to Kimi..." flash briefly, then the error - this is BETTER than "Thinking..." flash
- The proposal specifically wants to avoid the confusing "Thinking..." flash on errors
- No complex error handling logic needed

### Decision: Message Content

**Choice**: Use concise, user-friendly messages:

- "Connecting to {Provider}..." - initial connection
- "Setting up browser bridge..." - CDP-specific setup
- "Preparing agent loop..." - final initialization before first call

**Alternatives considered**:

- Technical details: "Initializing TCP socket...", "Validating JWT token..."
- Single generic message for all phases

**Rationale**:

- Users don't need technical details
- Multiple messages give sense of progress in CDP mode
- Messages are actionable and descriptive

## Data Flow

```
[User Approves Task]
         ↓
[TaskManager.approve()] → Sets status='running', creates TaskRunner
         ↓
[TaskRunner.run()] → Dispatches to runCdp() or runCode()
         ↓
[pushStatus('Connecting to {provider}...')] → task.summary set, UI updates
         ↓
[BrowserBridge setup / API key validation]
         ↓
     ┌───┴───┐
  Error    Success
    ↓          ↓
[finish()]  [pushStatus('Setting up browser bridge...')] (CDP only)
[error      ↓
 shown]   [First provider call]
              ↓
         [First step created]
              ↓
         [step pushed] → task.summary effectively replaced by step content
              ↓
         [... more steps ...]
              ↓
         [done action] → task.summary = action.summary (completion summary)
              ↓
         [UI shows completion summary]
```

## File Changes

| File                                       | Action | Description                                                                                                                   |
| ------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `src/main/agent/task-runner.ts`            | Modify | Add `pushStatus()` calls at entry points of `runCdp()` and `runCode()` methods with provider-specific initialization messages |
| `src/renderer/src/components/ChatFeed.tsx` | None   | No changes needed - existing logic already displays `task.summary` during initialization (lines 158-162)                      |

## Interfaces / Contracts

No new interfaces or type changes required. The implementation uses existing fields:

```typescript
// Existing Task type - no changes
interface Task {
  // ... other fields
  summary?: string  // Used for both initialization status AND completion summary
  status: TaskStatus
  steps: TaskStep[]
}

// Existing pushStatus method in TaskRunner - no signature changes
private pushStatus(msg: string): void {
  this.task.summary = msg
  this.pushUpdate()
}
```

## Testing Strategy

| Layer       | What to Test                               | Approach                                                                               |
| ----------- | ------------------------------------------ | -------------------------------------------------------------------------------------- |
| Unit        | Provider name capitalization               | Test helper function if extracted, or verify in integration                            |
| Integration | Status messages appear in correct sequence | Mock provider responses, verify task.summary values at each phase                      |
| Integration | Summary cleared on first step              | Verify task.summary is null/undefined after first step push                            |
| Integration | Completion summary still works             | Verify task.summary contains final summary when done action received                   |
| E2E         | UI displays initialization messages        | Manual or automated UI test - verify "Connecting to Kimi..." appears before first step |
| E2E         | Error handling without flash               | Simulate API key error, verify error appears without prolonged "Thinking..."           |

## Migration / Rollback

**No migration required.** This change is purely additive to the initialization flow.

**Rollback plan**:

1. Remove the `pushStatus()` calls added to `runCdp()` and `runCode()` entry points
2. Behavior reverts to showing "Thinking..." during initialization
3. Completion summaries continue to work via existing `task.summary` usage

## Implementation Details

### Provider Name Helper

```typescript
// Add private method to TaskRunner class
private getProviderDisplayName(): string {
  const provider = this.opts.provider
  // Capitalize first letter
  return provider.charAt(0).toUpperCase() + provider.slice(1)
}
```

### runCdp() Entry Point Changes

```typescript
private async runCdp(): Promise<Task> {
  // Set initial status IMMEDIATELY, before any validation
  this.pushStatus(`Connecting to ${this.getProviderDisplayName()}...`)

  // Check if this task actually needs the browser (CDP)
  const needsBrowser = ...
  let browserBridge: BrowserBridge | null = null

  if (needsBrowser) {
    // ... validation code ...

    // After bridge validation succeeds, update status
    this.pushStatus('Setting up browser bridge...')

    // ... tab creation ...
  }

  this.timeoutHandle = setTimeout(...)

  // Final initialization message before agent loop
  this.pushStatus(
    needsBrowser ? 'Preparing agent loop...' : 'Starting agent loop...'
  )

  // ... rest of method
}
```

### runCode() Entry Point Changes

```typescript
private async runCode(): Promise<Task> {
  // Set initial status immediately
  this.pushStatus(`Connecting to ${this.getProviderDisplayName()}...`)

  this.timeoutHandle = setTimeout(...)

  this.pushStatus('Preparing agent loop...')

  // ... rest of method
}
```

## Backward Compatibility

The implementation maintains full backward compatibility:

1. **Existing summary behavior**: When task completes, `task.summary` is set by the `done` action handler (lines 234, 358 in current code). This behavior is unchanged.

2. **UI behavior matrix** (from spec):

| Task State | Steps Count | task.summary    | UI Display (current code)      |
| ---------- | ----------- | --------------- | ------------------------------ |
| running    | 0           | null/undefined  | "Thinking..." (fallback)       |
| running    | 0           | "Connecting..." | "Connecting..." ✓              |
| running    | 1+          | null/undefined  | Step content                   |
| running    | 1+          | "Connecting..." | Step content (summary ignored) |
| completed  | any         | "Summary text"  | "Summary text" ✓               |
| error      | any         | Error message   | Error message ✓                |

3. **No schema changes**: Uses existing `task.summary` field

4. **No API changes**: All existing methods retain their signatures

## Open Questions

- [ ] Should we localize the initialization messages? (Out of scope per proposal)
- [ ] Should we add a small delay before showing initialization messages to avoid flash on very fast connections? (Not recommended - adds complexity for edge case)
