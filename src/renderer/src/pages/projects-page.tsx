import { useEffect, useRef, useState } from 'react'
import { IconFolder, IconPlus } from '../components/icons'
import { PageContent } from '../components/layout'
import { useCreateProject, useDeleteProject, useProjects } from '../queries'
import { addTaskToProject } from '../queries/projects/service'

export function ProjectsPage(): React.JSX.Element {
  const [showCreateProject, setShowCreateProject] = useState(false)
  const [createProjectName, setCreateProjectName] = useState('')
  const [pendingProjectTaskId, setPendingProjectTaskId] = useState<string | null>(null)

  const closeCreateProjectModal = () => {
    setShowCreateProject(false)
    setPendingProjectTaskId(null)
    setCreateProjectName('')
  }

  const projectNameInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!showCreateProject) return
    projectNameInputRef.current?.focus()
  }, [showCreateProject])

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
    <PageContent title="Projects" showBack backTo="/tasks">
      {projects.length === 0 ? (
        <div className="projectsPlaceholder">
          <div className="projectsPlaceholderIcon">
            <IconFolder width="40" height="40" />
          </div>
          <span className="projectsPlaceholderSub">
            Group and manage your tasks. Drag a task onto the Projects button to get started.
          </span>
          <button
            type="button"
            className="projectsCreateBtn"
            onClick={() => {
              setPendingProjectTaskId(null)
              setShowCreateProject(true)
            }}
          >
            <IconPlus width="16" height="16" />
            Create Project
          </button>
        </div>
      ) : (
        <div className="projectsListPanel">
          <div className="projectsListHeader">
            <button
              type="button"
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
            <form
              key={proj.id}
              className="projectCard"
              onSubmit={(e) => {
                e.preventDefault()
              }}
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
                type="button"
                className="projectCardDelete"
                onClick={() => handleDeleteProject(proj.id)}
              >
                ×
              </button>
            </form>
          ))}
        </div>
      )}

      {showCreateProject && (
        <div className="projectModalOverlay">
          <button
            type="button"
            className="projectModalBackdrop"
            aria-label="Close create project modal"
            onClick={closeCreateProjectModal}
          />
          <div className="projectModalCard">
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
              ref={projectNameInputRef}
            />
            <div className="projectModalActions">
              <button
                type="button"
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
                type="button"
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
    </PageContent>
  )
}
