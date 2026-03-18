import { useEffect, useRef, useState } from 'react'
import { IconFolder, IconPlus } from '../components/icons'
import { PageContent } from '../components/layout'
import { ProjectButton } from '../components/ui/project-button'
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
        <div className="flex flex-col items-center justify-center gap-[10px] opacity-70">
          <div
            className="w-[72px] h-[72px] rounded-[16px] bg-[rgba(255,255,255,0.06)] flex items-center justify-center text-[rgba(255,255,255,0.3)] mb-[4px]"
          >
            <IconFolder width="40" height="40" />
          </div>
          <span className="text-[14px] text-[rgba(255,255,255,0.4)] max-w-[240px] text-center leading-[1.4]">
            Group and manage your tasks. Drag a task onto the Projects button to get started.
          </span>
          <ProjectButton
            variant="filled"
            onClick={() => {
              setPendingProjectTaskId(null)
              setShowCreateProject(true)
            }}
          >
            <IconPlus width="16" height="16" />
            Create Project
          </ProjectButton>
        </div>
      ) : (
        <div className="w-full max-w-[480px] flex flex-col gap-[8px]">
          <div className="flex items-center justify-between mb-[4px]">
            <ProjectButton
              variant="default"
              size="small"
              onClick={() => {
                setPendingProjectTaskId(null)
                setShowCreateProject(true)
              }}
            >
              + New
            </ProjectButton>
          </div>
          {projects.map((proj) => (
            <form
              key={proj.id}
              className="flex items-center gap-[12px] bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-[10px] p-[12px_14px] transition-[background-color,border-color] duration-[150ms] hover:border-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.08)]"
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
              <div className="w-[10px] h-[10px] rounded-full flex-shrink-0" style={{ background: proj.color }} />
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-[500] text-white">{proj.name}</div>
                <div className="text-[12px] text-[rgba(255,255,255,0.45)]">
                  {proj.taskIds.length} task{proj.taskIds.length !== 1 ? 's' : ''}
                </div>
              </div>
              <button
                type="button"
                className="appearance-none bg-transparent border-none text-[rgba(255,255,255,0.3)] cursor-pointer px-[6px] py-[2px] leading-none text-[18px] hover:text-[var(--nb-danger,#ef4444)]"
                onClick={() => handleDeleteProject(proj.id)}
              >
                ×
              </button>
            </form>
          ))}
        </div>
      )}

      {showCreateProject && (
        <div className="fixed inset-0 z-[300] bg-[rgba(0,0,0,0.5)] flex items-center justify-start pl-[280px]">
          <button
            type="button"
            className="absolute inset-0 z-0 border-none bg-transparent p-0 cursor-pointer"
            aria-label="Close create project modal"
            onClick={closeCreateProjectModal}
          />
          <div
            className="relative z-[1] bg-[var(--nb-bg)] border border-[var(--nb-border)] rounded-[14px] p-[24px] w-[340px] flex flex-col gap-[12px]"
            style={{ boxShadow: 'var(--nb-shadow)' }}
          >
            <div className="text-[16px] font-[600] text-[var(--nb-text)]">New Project</div>
            {pendingProjectTaskId && (
              <div className="text-[12px] text-[var(--nb-muted)]">Task will be added to this project</div>
            )}
            <input
              className="appearance-none w-full bg-[var(--nb-code-bg)] border border-[var(--nb-border)] rounded-[8px] p-[10px_12px] text-[var(--nb-text)] text-[14px] font-inherit outline-none focus:border-[var(--nb-accent-2)]"
              placeholder="Project name…"
              value={createProjectName}
              onChange={(e) => setCreateProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && createProjectName.trim())
                  void handleCreateProject(createProjectName.trim(), pendingProjectTaskId)
              }}
              ref={projectNameInputRef}
            />
            <div className="flex justify-end gap-[8px] mt-[4px]">
              <button
                type="button"
                className="appearance-none bg-transparent border border-[var(--nb-border)] rounded-[8px] text-[var(--nb-muted)] px-[16px] py-[8px] cursor-pointer font-inherit text-[13px]"
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
                className="appearance-none bg-[var(--nb-accent-2)] border-none rounded-[8px] text-white px-[16px] py-[8px] cursor-pointer font-inherit text-[13px] font-[500] disabled:opacity-[0.4] disabled:cursor-default"
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
