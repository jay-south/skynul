import type { TaskCapabilityId } from "@skynul/shared";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { InputBar } from "../components/InputBar";
import { useCreateTask } from "../queries";

export function TasksIndexPage(): React.JSX.Element {
  const navigate = useNavigate();
  const [, setComposerPrompt] = useState("");
  const createTaskMutation = useCreateTask();

  const detectAutoCaps = (prompt: string): TaskCapabilityId[] => {
    const lower = prompt.toLowerCase();
    const detected = new Set<TaskCapabilityId>();

    // Browser keywords
    const browserWords = [
      "browser",
      "webpage",
      "website",
      "scrape",
      "navigate",
      "url",
      "search",
      "google",
    ];
    if (browserWords.some((w) => lower.includes(w)))
      detected.add("browser.cdp");

    // App launch keywords
    const appWords = [
      "launch",
      "whatsapp",
      "telegram",
      "discord",
      "slack",
      "spotify",
    ];
    if (appWords.some((w) => lower.includes(w))) detected.add("app.launch");

    // Default
    if (detected.size === 0) detected.add("browser.cdp");

    return [...detected];
  };

  const handleSubmit = (text: string, attachments?: string[]) => {
    const caps = detectAutoCaps(text);

    // Detect mode
    let mode: "browser" | "code" = "browser";
    const codeWords = [
      "command",
      "script",
      "headless",
      "fetch",
      "curl",
      "code",
      "git",
      "build",
      "deploy",
    ];
    if (codeWords.some((w) => text.toLowerCase().includes(w))) mode = "code";

    createTaskMutation.mutate(
      { prompt: text, capabilities: caps, mode, attachments },
      {
        onSuccess: (response) => {
          navigate(`/tasks/${response.task.id}`);
        },
        onError: (error) => {
          console.error("Failed to create task:", error);
        },
      },
    );
  };

  return (
    <div className="chatFeedCentered">
      <div className="composerHeading">What do you want to automate?</div>
      <div
        style={{
          color: "var(--nb-muted)",
          fontSize: "14px",
          marginBottom: "24px",
          textAlign: "center",
        }}
      >
        Describe the task and I'll get it done for you.
      </div>
      <InputBar
        lang="en"
        autoCaps={["browser.cdp"]}
        compact={false}
        onSubmit={handleSubmit}
        onTextChange={setComposerPrompt}
      />

      <div
        style={{
          marginTop: "32px",
          padding: "16px 20px",
          background: "var(--nb-panel)",
          borderRadius: "12px",
          border: "1px solid var(--nb-border)",
          maxWidth: "480px",
        }}
      >
        <div
          style={{
            fontSize: "12px",
            fontWeight: 600,
            marginBottom: "8px",
            color: "var(--text-primary)",
          }}
        >
          Examples:
        </div>
        <div
          style={{
            fontSize: "12px",
            color: "var(--nb-muted)",
            lineHeight: 1.6,
          }}
        >
          • "Post on Twitter: 'Just shipped a new feature!'" <br />
          • "Search for Python tutorials on YouTube" <br />
          • "Check my Gmail for emails from John" <br />• "Create a Google Doc
          with meeting notes"
        </div>
      </div>
    </div>
  );
}
