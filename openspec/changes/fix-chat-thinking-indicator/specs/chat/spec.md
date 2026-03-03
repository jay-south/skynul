# Chat Initialization UX Specification

## Purpose

Define the behavior of the chat interface during task initialization, ensuring users receive clear, descriptive feedback about what's happening while waiting for the AI provider to respond.

## Requirements

### Requirement: Initialization Status Messages

The system MUST display descriptive initialization status messages to the user when a task is starting, before the first step is created.

#### Scenario: User approves a task and sees initialization message

- GIVEN a task has been approved by the user
- AND the task status is "running"
- AND no steps have been created yet
- WHEN the system begins initialization
- THEN the UI MUST display a descriptive message indicating the current initialization phase
- AND the message MUST include the provider name when available (e.g., "Connecting to Kimi...")

#### Scenario: API key validation failure shows error immediately

- GIVEN a task has been approved
- AND the task is in the initialization phase
- WHEN an API key validation error occurs
- THEN the UI MUST display the error message immediately
- AND the initialization status message MUST NOT be shown

#### Scenario: First step arrival clears initialization message

- GIVEN a task is displaying an initialization status message
- WHEN the first step is created from the provider response
- THEN the initialization status message MUST be cleared
- AND the step content MUST be displayed

### Requirement: Provider-Specific Messaging

The system MUST display provider-specific initialization messages that indicate which AI provider is being connected to.

#### Scenario: Multiple providers show respective names

- GIVEN the application supports multiple AI providers (Kimi, Claude, etc.)
- WHEN a task starts with a specific provider
- THEN the initialization message MUST include the provider name
- AND the message format MUST be "Connecting to {providerName}..."

#### Scenario: Generic fallback when provider unavailable

- GIVEN a task is starting
- AND the provider name is not available in the current context
- WHEN displaying the initialization message
- THEN the system MUST show a generic message: "Connecting to AI provider..."

### Requirement: Initialization Phase Coverage

The system MUST provide status messages for all initialization phases before the first provider call.

#### Scenario: CDP mode initialization

- GIVEN the task is running in CDP (browser automation) mode
- WHEN the system initializes
- THEN the user MUST see sequential status messages:
  - "Connecting to {provider}..."
  - "Setting up browser bridge..."
  - "Preparing agent loop..."

#### Scenario: Code mode initialization

- GIVEN the task is running in Code mode
- WHEN the system initializes
- THEN the user MUST see the message: "Connecting to {provider}..."
- AND "Validating API key..." MAY be shown if validation is performed

### Requirement: Error Handling Without Flash

The system MUST handle initialization errors gracefully without showing transient "Thinking..." messages.

#### Scenario: Immediate error on invalid API key

- GIVEN a task has been approved
- AND the API key is invalid or missing
- WHEN the initialization begins
- THEN the error MUST be displayed immediately
- AND no "Thinking..." or initialization message flash MUST occur

#### Scenario: Connection timeout error

- GIVEN a task is in the initialization phase
- AND the connection to the provider times out
- WHEN the timeout occurs
- THEN the error message MUST replace the initialization status
- AND the user MUST see a clear error description

### Requirement: Backward Compatibility

The system MUST maintain existing functionality for task completion summaries.

#### Scenario: Task completion summary still works

- GIVEN a task has completed successfully
- WHEN the final summary is generated
- THEN the task.summary field MUST be set to the completion summary
- AND the UI MUST display the completion summary as before

## State Transitions

```
[Task Approved]
      ↓
[Initialization Phase] → Display status message (task.summary)
      ↓
[First Step Created] → Clear status message, show step content
      ↓
[Task Running] → Continue with step-by-step display
      ↓
[Task Complete] → Display completion summary (task.summary)
```

## UI Behavior Matrix

| Task State | Steps Count | task.summary    | UI Display                     |
| ---------- | ----------- | --------------- | ------------------------------ |
| running    | 0           | null/undefined  | "Thinking..." (fallback)       |
| running    | 0           | "Connecting..." | "Connecting..."                |
| running    | 1+          | null/undefined  | Step content                   |
| running    | 1+          | "Connecting..." | Step content (summary ignored) |
| completed  | any         | "Summary text"  | "Summary text"                 |
| error      | any         | Error message   | Error message                  |

## Implementation Notes

- The `task.summary` field is used for both initialization status and completion summaries
- During initialization (status='running', steps.length=0), task.summary contains status messages
- After first step arrives, task.summary should be cleared (set to null/undefined)
- At task completion, task.summary contains the final summary
- The UI must distinguish between initialization messages and completion summaries based on task state
