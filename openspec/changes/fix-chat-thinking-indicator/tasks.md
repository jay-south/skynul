# Tasks: Fix Chat Thinking Indicator UX

## Phase 1: Foundation - Add Provider Display Name Helper

- [x] 1.1 Add `getProviderDisplayName()` private method to TaskRunner class
  - **File**: `src/main/agent/task-runner.ts`
  - **Details**: Create a private method that capitalizes the provider ID (e.g., 'kimi' → 'Kimi', 'claude' → 'Claude')
  - **Acceptance**: Method returns capitalized provider name from `this.opts.provider`
  - **Test**: Verify 'kimi' returns 'Kimi', 'claude' returns 'Claude', 'deepseek' returns 'Deepseek'

## Phase 2: Core Implementation - CDP Mode Initialization Messages

- [x] 2.1 Add initial connection status message at `runCdp()` entry point
  - **File**: `src/main/agent/task-runner.ts`
  - **Details**: Add `this.pushStatus(\`Connecting to \${this.getProviderDisplayName()}...\`)`as the FIRST line in`runCdp()` method, before any validation
  - **Acceptance**: Status message is set immediately when `runCdp()` is called
  - **Test**: Verify task.summary contains "Connecting to Kimi..." (or appropriate provider) at start

- [x] 2.2 Add browser bridge setup status message in CDP mode
  - **File**: `src/main/agent/task-runner.ts`
  - **Details**: After browser bridge validation succeeds (inside `if (needsBrowser)` block), add `this.pushStatus('Setting up browser bridge...')`
  - **Acceptance**: Message appears only when browser is needed and validation passes
  - **Test**: Verify message appears after successful bridge validation

- [x] 2.3 Add agent loop preparation status message in CDP mode
  - **File**: `src/main/agent/task-runner.ts`
  - **Details**: After timeout setup, add `this.pushStatus(needsBrowser ? 'Preparing agent loop...' : 'Starting agent loop...')`
  - **Acceptance**: Context-aware message appears before first provider call
  - **Test**: Verify correct message based on needsBrowser flag

## Phase 3: Core Implementation - Code Mode Initialization Messages

- [x] 3.1 Add initial connection status message at `runCode()` entry point
  - **File**: `src/main/agent/task-runner.ts`
  - **Details**: Add `this.pushStatus(\`Connecting to \${this.getProviderDisplayName()}...\`)`as the FIRST line in`runCode()` method
  - **Acceptance**: Status message is set immediately when `runCode()` is called
  - **Test**: Verify task.summary contains "Connecting to Kimi..." at start

- [x] 3.2 Add agent loop preparation status message in Code mode
  - **File**: `src/main/agent/task-runner.ts`
  - **Details**: After timeout setup, add `this.pushStatus('Preparing agent loop...')`
  - **Acceptance**: Message appears before first provider call
  - **Test**: Verify message appears in correct sequence

## Phase 4: Integration - UI Display Verification

- [x] 4.1 Verify ChatFeed displays task.summary during initialization
  - **File**: `src/renderer/src/components/ChatFeed.tsx`
  - **Details**: Confirm existing logic at lines 158-162 correctly displays `task.summary` when available (no code changes needed per design)
  - **Acceptance**: UI shows "Connecting to Kimi..." instead of "Thinking..." during initialization
  - **Test**: Manual verification - start a task and observe initialization message

- [x] 4.2 Verify initialization message clears on first step
  - **File**: `src/renderer/src/components/ChatFeed.tsx`
  - **Details**: Confirm that when first step arrives, initialization message is replaced by step content
  - **Acceptance**: UI transitions from initialization message to step content seamlessly
  - **Test**: Verify UI behavior matrix from spec is satisfied

## Phase 5: Testing - Integration & Error Handling

- [ ] 5.1 Test status message sequence in CDP mode
  - **Approach**: Mock provider responses, verify task.summary values at each phase
  - **Scenarios**:
    - "Connecting to Kimi..." appears first
    - "Setting up browser bridge..." appears when browser needed
    - "Preparing agent loop..." appears before first call
  - **Acceptance**: All three messages appear in correct order

- [ ] 5.2 Test status message sequence in Code mode
  - **Approach**: Mock provider responses, verify task.summary values
  - **Scenarios**:
    - "Connecting to Kimi..." appears first
    - "Preparing agent loop..." appears before first call
  - **Acceptance**: Both messages appear in correct order

- [ ] 5.3 Test error handling without "Thinking..." flash
  - **Approach**: Simulate API key error, verify error appears immediately
  - **Scenarios**:
    - Invalid API key shows error without prolonged "Thinking..."
    - Missing API key shows error immediately
  - **Acceptance**: User sees initialization message briefly, then error (no confusing flash)

- [ ] 5.4 Test completion summary still works
  - **Approach**: Complete a task, verify final summary is displayed
  - **Acceptance**: task.summary contains final summary when done action received
  - **Test**: Verify existing completion summary behavior is preserved

- [ ] 5.5 Test provider name fallback
  - **Approach**: Test with various provider IDs
  - **Scenarios**:
    - 'kimi' → 'Kimi'
    - 'claude' → 'Claude'
    - 'deepseek' → 'Deepseek'
    - 'chatgpt' → 'Chatgpt'
  - **Acceptance**: All providers display correctly capitalized

## Phase 6: Verification & Cleanup

- [ ] 6.1 Verify backward compatibility matrix
  - **Verify**: All UI behavior matrix scenarios from spec work correctly
  - **Scenarios**:
    - running + 0 steps + null summary → "Thinking..." (fallback)
    - running + 0 steps + "Connecting..." → "Connecting..."
    - running + 1+ steps → Step content
    - completed + summary → Summary text
    - error + message → Error message
  - **Acceptance**: All scenarios behave as specified

- [x] 6.2 Code review and cleanup
  - **Review**: Ensure all pushStatus calls are properly placed
  - **Cleanup**: Remove any debug logging or temporary code
  - **Acceptance**: Code is clean, follows existing patterns

- [x] 6.3 Update any relevant comments or documentation
  - **File**: `src/main/agent/task-runner.ts`
  - **Details**: Add brief comments explaining the initialization status messages if not self-explanatory
  - **Acceptance**: Code is well-documented
