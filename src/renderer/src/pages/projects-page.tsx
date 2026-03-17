import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCreateProject, useDeleteProject, useProjects } from '../queries'
import { addTaskToProject } from '../queries/projects/service'

export function ProjectsPage(): React.JSX.Element {
  const navigate = useNavigate()
  const [showCreateProject, setShowCreateProject] = useState(false)
  const [createProjectName, setCreateProjectName] = useState('')
  const [pendingProjectTaskId, setPendingProjectTaskId] = useState<string | null>(null)

  // Queries
  const { data: projects = [] } = useProjects()

  // Mutations
  const createProjectMutation = useCreateProject()
  const deleteProjectMutation = useDeleteProject()

  const handleCreateProject = async (name: string, taskId?: string | null) => {
    const newProject = await createProjectMutation.mutateAsync(name)
    if (taskId && newProject) {
      await addTaskToProject(newProject.id, taskId)
    }
    setShowCreateProject(false)
    setCreateProjectName('')
    setPendingProjectTaskId(null)
  }

  const handleDeleteProject = (projectId: string) => {
    deleteProjectMutation.mutate(projectId)
  }

  const handleDropTask = async (e: React.DragEvent, projectId: string) => {
    e.preventDefault()
    e.stopPropagation()
    const taskId = e.dataTransfer.getData('text/task-id')
    if (taskId) {
      await addTaskToProject(projectId, taskId)
    }
  }

  return (
    <div className="settingsPanel">
      <div className="settingsPanelInner">
        <div className="settingsBackBar">
          <button
            className="backBtn"
            onClick={() => navigate('/tasks')}
            aria-label="Back to tasks"
            title="Back to tasks"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
            </svg>
            <span>Back</span>
          </button>
        </div>

        <h2 className="settingsPanelTitle">Projects</h2>

        <div className="chatFeedCentered">
          {projects.length === 0 ? (
            <div className="projectsPlaceholder">
              <div className="projectsPlaceholderIcon">
                <svg
                  viewBox="0 0 24 24"
                  width="40"
                  height="40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <span className="projectsPlaceholderTitle">No projects yet</span>
              <span className="projectsPlaceholderSub">
                Group and manage your tasks. Drag a task onto the Projects button to get started.
              </span>
              <button
                className="projectsCreateBtn"
                onClick={() => {
                  setPendingProjectTaskId(null)
                  setShowCreateProject(true)
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Create Project
              </button>
            </div>
          ) : (
            <div className="projectsListPanel">
              <div className="projectsListHeader">
                <span className="projectsListTitle">Projects</span>
                <button
                  className="projectsCreateBtn small"
                  onClick={() => {
                    setPendingProjectTaskId(null)
                    setShowCreateProject(true)
                  }}
                >
                  + New
                </button>
              </div>
              {projects.map((proj) => (
                <div
                  key={proj.id}
                  className="projectCard"
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    e.dataTransfer.dropEffect = 'move'
                  }}
                  onDrop={(e) => handleDropTask(e, proj.id)}
                >
                  <div className="projectCardColor" style={{ background: proj.color }} />
                  <div className="projectCardBody">
                    <div className="projectCardName">{proj.name}</div>
                    <div className="projectCardMeta">
                      {proj.taskIds.length} task{proj.taskIds.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <button
                    className="projectCardDelete"
                    onClick={() => handleDeleteProject(proj.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {showCreateProject && (
            <div
              className="projectModalOverlay"
              onClick={() => {
                setShowCreateProject(false)
                setPendingProjectTaskId(null)
                setCreateProjectName('')
              }}
            >
              <div className="projectModalCard" onClick={(e) => e.stopPropagation()}>
                <div className="projectModalTitle">New Project</div>
                {pendingProjectTaskId && (
                  <div className="projectModalSub">Task will be added to this project</div>
                )}
                <input
                  className="projectModalInput"
                  placeholder="Project name…"
                  value={createProjectName}
                  onChange={(e) => setCreateProjectName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && createProjectName.trim())
                      void handleCreateProject(createProjectName.trim(), pendingProjectTaskId)
                  }}
                  autoFocus
                />
                <div className="projectModalActions">
                  <button
                    className="projectModalCancel"
                    onClick={() => {
                      setShowCreateProject(false)
                      setPendingProjectTaskId(null)
                      setCreateProjectName('')
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="projectModalSave"
                    disabled={!createProjectName.trim()}
                    onClick={() =>
                      void handleCreateProject(createProjectName.trim(), pendingProjectTaskId)
                    }
                  >
                    Create
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
