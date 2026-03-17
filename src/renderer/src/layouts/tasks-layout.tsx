import { useMemo } from "react";
import { Outlet, useNavigate, useParams } from "react-router-dom";
import {
  useCancelTask,
  useCreateTask,
  useDeleteTask,
  useTasks,
} from "../queries/tasks";

export function TasksLayout(): React.JSX.Element {
  const navigate = useNavigate();
  const { taskId } = useParams();

  // Queries
  const { data: tasksResponse } = useTasks();
  const tasks = tasksResponse?.tasks ?? [];

  // Mutations
  const createTaskMutation = useCreateTask();
  const deleteTaskMutation = useDeleteTask();
  const cancelTaskMutation = useCancelTask();

  // Get root tasks only (no parent) - limit to last 20 for performance
  const rootTasks = useMemo(() => {
    return tasks
      .filter((t) => !t.parentTaskId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 20);
  }, [tasks]);

  // Get active root task ID
  const activeRootId = useMemo(() => {
    if (!taskId) return null;
    const byId = new Map(tasks.map((t) => [t.id, t] as const));
    let cur = byId.get(taskId);
    let hops = 0;
    while (cur?.parentTaskId && hops < 50) {
      const next = byId.get(cur.parentTaskId);
      if (!next) break;
      cur = next;
      hops++;
    }
    return cur?.id ?? taskId;
  }, [tasks, taskId]);

  // Create new task immediately and navigate to it
  const handleNewTask = () => {
    createTaskMutation.mutate(
      {
        prompt: "",
        capabilities: ["browser.cdp"],
        mode: "browser",
      },
      {
        onSuccess: (response) => {
          navigate(`/tasks/${response.task.id}`);
        },
      },
    );
  };

  // Check if we're on the "new task" page (index)
  const isNewTaskPage = !taskId;

  return (
    <div className="tasksLayout">
      {/* Task sidebar - compact */}
      <div className="tasksSidebar">
        {/* New Task Button */}
        <div className="sidebarToolbar">
          <button
            className="sidebarToolbarBtn"
            onClick={handleNewTask}
            disabled={createTaskMutation.isPending}
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            New
          </button>
        </div>

        {/* Task List - compact */}
        <div className="taskPanelWrap" style={{ flex: 1, overflow: "auto" }}>
          {/* New Task Item (when on index page) */}
          {isNewTaskPage && (
            <div className="rbItem active" style={{ opacity: 0.7 }}>
              <div className="rbItemContent">
                <div className="rbItemTitle" style={{ fontStyle: "italic" }}>
                  New task...
                </div>
                <div className="rbItemMeta">
                  <span className="taskStatusBadge">Draft</span>
                </div>
              </div>
            </div>
          )}

          {/* Existing Tasks */}
          {rootTasks.map((t) => (
            <div
              key={t.id}
              className={`rbItem ${t.id === activeRootId ? "active" : ""}`}
              onClick={() => navigate(`/tasks/${t.id}`)}
              style={{ cursor: "pointer" }}
            >
              <div className="rbItemContent">
                <div className="rbItemTitle">
                  {t.prompt?.slice(0, 35) || "Untitled task"}
                  {t.prompt && t.prompt.length > 35 ? "..." : ""}
                </div>
                <div className="rbItemMeta">
                  <span
                    className="taskStatusBadge"
                    style={{
                      color:
                        t.status === "failed"
                          ? "var(--nb-danger)"
                          : t.status === "running" || t.status === "completed"
                            ? "var(--nb-accent-2)"
                            : "var(--nb-muted)",
                    }}
                  >
                    {t.status === "pending_approval"
                      ? "Pending"
                      : t.status === "approved"
                        ? "Approved"
                        : t.status === "running"
                          ? "Running"
                          : t.status === "completed"
                            ? "Done"
                            : t.status === "failed"
                              ? "Failed"
                              : t.status === "cancelled"
                                ? "Cancelled"
                                : t.status}
                  </span>
                </div>
              </div>
              <button
                className="rbMenuBtn"
                aria-label="Task options"
                onClick={(e) => {
                  e.stopPropagation();
                  if (t.status === "running") {
                    cancelTaskMutation.mutate(t.id);
                  } else {
                    deleteTaskMutation.mutate(t.id);
                  }
                }}
              >
                {t.status === "running" ? "⏹" : "×"}
              </button>
            </div>
          ))}

          {rootTasks.length === 0 && !isNewTaskPage && (
            <div
              className="taskEmpty"
              style={{
                padding: "12px",
                fontSize: "12px",
                color: "var(--nb-muted)",
              }}
            >
              No tasks yet
            </div>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="tasksMain">
        <Outlet />
      </div>
    </div>
  );
}
