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
          fontSize: "15px",
          marginBottom: "32px",
          textAlign: "center",
          maxWidth: "400px",
          lineHeight: 1.5,
        }}
      >
        Describe what you need and I'll handle it for you.
      </div>
      <InputBar
        lang="en"
        autoCaps={["browser.cdp"]}
        compact={false}
        onSubmit={handleSubmit}
        onTextChange={setComposerPrompt}
      />
    </div>
  );
}
