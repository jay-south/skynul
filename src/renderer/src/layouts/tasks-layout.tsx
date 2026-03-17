import { useEffect, useState } from "react";
import { Outlet, useLocation, useParams } from "react-router-dom";
import { TaskDrawer } from "../components/TaskDrawer";

export function TasksLayout(): React.JSX.Element {
  const location = useLocation();
  const { taskId } = useParams();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Auto-open drawer when viewing a specific task, close when on index
  useEffect(() => {
    if (taskId) {
      setIsDrawerOpen(true);
    } else {
      // On /tasks (index), drawer closed by default
      setIsDrawerOpen(false);
    }
  }, [taskId, location.pathname]);

  return (
    <div style={{ display: "flex", height: "100%" }}>
      {/* Main content - takes full width */}
      <div style={{ flex: 1, position: "relative" }}>
        {/* Floating button to open drawer */}
        {!isDrawerOpen && (
          <button
            onClick={() => setIsDrawerOpen(true)}
            style={{
              position: "absolute",
              top: "16px",
              left: "16px",
              zIndex: 50,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 16px",
              background: "var(--nb-panel)",
              border: "1px solid var(--nb-border)",
              borderRadius: "10px",
              color: "var(--text-primary)",
              fontSize: "14px",
              fontWeight: 500,
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--nb-hover)";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--nb-panel)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            Tasks
          </button>
        )}

        <Outlet />
      </div>

      {/* Task Drawer */}
      <TaskDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </div>
  );
}
