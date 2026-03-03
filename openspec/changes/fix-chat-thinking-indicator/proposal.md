# Proposal: Fix Chat Thinking Indicator UX

## Intent

The "Thinking..." indicator in the chat appears when it shouldn't, creating a confusing user experience. When a task is approved and starts running, the indicator shows immediately because `task.status === 'running'` and `task.steps.length === 0`. However, the first step is only created AFTER the provider responds. If there's an API key error (which happens immediately), the user sees "Thinking..." briefly before the error appears.

This is a UX bug where the user doesn't know what's actually happening during the initialization phase. The user sees "Thinking..." when the system is actually:

- Connecting to the provider (Kimi, Claude, etc.)
- Validating API keys
- Setting up the browser bridge (CDP mode)
- Preparing the agent loop

We need to provide immediate, descriptive feedback to the user about the actual initialization status.

## Scope

### In Scope

- Update `task-runner.ts` to set descriptive `task.summary` messages during initialization
- Update `ChatFeed.tsx` to display the `task.summary` during the initialization phase
- Ensure status messages are cleared/set appropriately when the first step arrives
- Handle both CDP mode and Code mode initialization phases

### Out of Scope

- Changing the task state machine or status flow
- Adding new task statuses (e.g., 'initializing')
- Modifying the provider API calls
- Adding progress bars or percentage indicators
- Localization of status messages

## Approach

Use the existing `task.summary` field to show descriptive messages before the first provider call. The `task.summary` field is already used for final summaries when tasks complete, but we can leverage it during the running phase to show initialization status.

Key implementation points:

1. **In `task-runner.ts`**: Set `task.summary` to descriptive messages at key initialization points:
   - "Connecting to {provider}..."
   - "Validating API key..."
   - "Setting up browser bridge..."
   - "Preparing agent loop..."

2. **In `ChatFeed.tsx`**: Modify the thinking indicator logic (lines 158-162) to display `task.summary` when available during the initialization phase, falling back to "Thinking..." only when no summary is set.

3. **Clear the summary** when the first step is created, so the UI transitions naturally from initialization message to actual step content.

This approach is minimal, non-breaking, and leverages existing fields without schema changes.

## Affected Areas

| Area                                       | Impact   | Description                                                                     |
| ------------------------------------------ | -------- | ------------------------------------------------------------------------------- |
| `src/main/agent/task-runner.ts`            | Modified | Add `pushStatus()` calls with descriptive messages during initialization phases |
| `src/renderer/src/components/ChatFeed.tsx` | Modified | Update thinking indicator to show `task.summary` when available                 |
| `src/shared/task.ts`                       | None     | No changes needed - using existing `summary` field                              |

## Risks

| Risk                                                    | Likelihood | Mitigation                                                                                          |
| ------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------- |
| Summary messages may persist incorrectly if not cleared | Low        | Ensure summary is cleared when first step is pushed; add unit test coverage                         |
| Provider name may not be available in all contexts      | Low        | Use generic fallback messages like "Connecting to AI provider..."                                   |
| Messages may be too technical for end users             | Low        | Use user-friendly language: "Connecting..." instead of "Initializing TCP socket..."                 |
| Race condition between summary update and step creation | Low        | The pushUpdate() mechanism ensures atomic updates; summary will be visible until first step renders |

## Rollback Plan

1. Revert changes to `task-runner.ts` - remove the `pushStatus()` calls during initialization
2. Revert changes to `ChatFeed.tsx` - restore original thinking indicator logic
3. The `task.summary` field will continue to work as before (used for final summaries)

This is a low-risk change with minimal surface area.

## Dependencies

- None - this change uses existing fields and mechanisms

## Success Criteria

- [ ] When a task starts, the user sees "Connecting to {provider}..." or similar instead of "Thinking..."
- [ ] When there's an API key error, the user sees the initialization message briefly, then the error (no confusing "Thinking..." flash)
- [ ] When the first step arrives, the initialization message is replaced by step content
- [ ] Existing functionality (task completion summaries) continues to work
- [ ] Both CDP mode and Code mode show appropriate initialization messages
