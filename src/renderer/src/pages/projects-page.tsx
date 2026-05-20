import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'
import { ContentCard } from '@/components/content-card'
import { PageHeader } from '@/components/page-header'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '@/components/ui/breadcrumb'
import { useAddTaskToProject, useCreateProject, useDeleteProject, useProjects } from '../queries'

export function ProjectsPage(): React.JSX.Element {
  const [showCreateProject, setShowCreateProject] = useState(false)
  const [createProjectName, setCreateProjectName] = useState('')
  const [pendingProjectTaskId, setPendingProjectTaskId] = useState<string | null>(null)

  const { data: projects = [] } = useProjects()
  const createProjectMutation = useCreateProject()
  const deleteProjectMutation = useDeleteProject()
  const addTaskMutation = useAddTaskToProject()

  const handleCreateProject = async (name: string, taskId?: string | null) => {
    const newProject = await createProjectMutation.mutateAsync(name)
    if (taskId && newProject)
      await addTaskMutation.mutateAsync({ projectId: newProject.id, taskId })
    setShowCreateProject(false)
    setCreateProjectName('')
    setPendingProjectTaskId(null)
  }

  const handleDeleteProject = (projectId: string) => deleteProjectMutation.mutate(projectId)

  const handleDropTask = async (e: React.DragEvent, projectId: string) => {
    e.preventDefault()
    e.stopPropagation()
    const taskId = e.dataTransfer.getData('text/task-id')
    if (taskId) await addTaskMutation.mutateAsync({ projectId, taskId })
  }

  return (
    <div className="h-full overflow-hidden">
      <div className="h-full overflow-y-auto px-6 py-6 mx-auto w-full max-w-6xl">
        <Breadcrumb className="mb-4">
          <BreadcrumbList className="text-base text-nb-muted">
            <BreadcrumbItem>
              <BreadcrumbLink asChild className="text-nb-muted hover:text-nb-text">
                <Link to="/dashboard">Home</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="text-nb-text">Projects</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <PageHeader
          title="Projects"
          description="Group and organize your tasks into projects."
          className="mb-6"
        />

        {projects.length === 0 ? (
          <div className="flex justify-center pt-12">
            <div className="flex flex-col items-center gap-3">
              <div className="size-[72px] rounded-xl bg-nb-panel flex items-center justify-center text-nb-muted">
                <svg
                  viewBox="0 0 24 24"
                  width="40"
                  height="40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <title>Projects icon</title>
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <span className="text-lg font-semibold text-nb-text">No projects yet</span>
              <span className="text-sm text-nb-muted max-w-[240px] text-center leading-relaxed">
                Group and manage your tasks. Drag a task onto the Projects button to get started.
              </span>
              <button
                type="button"
                onClick={() => {
                  setPendingProjectTaskId(null)
                  setShowCreateProject(true)
                }}
                className="flex items-center gap-1.5 rounded-xl bg-nb-accent-2 text-white px-5 py-2.5 mt-1 cursor-pointer text-xs font-medium transition-all duration-150 hover:opacity-90 border-none"
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
                  aria-hidden="true"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Create Project
              </button>
            </div>
          </div>
        ) : (
          <ContentCard title="Projects">
            <div className="flex items-center justify-end mb-3">
              <button
                type="button"
                onClick={() => {
                  setPendingProjectTaskId(null)
                  setShowCreateProject(true)
                }}
                className="flex items-center gap-1.5 rounded-lg bg-nb-accent-2 text-white px-3 py-1.5 cursor-pointer text-xs font-medium transition-all duration-150 hover:opacity-90 border-none"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                New
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {projects.map((proj) => (
                <Fragment key={proj.id}>
                  {/* biome-ignore lint/a11y/noStaticElementInteractions: Drop zone for tasks dragged from the list. */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      e.dataTransfer.dropEffect = 'move'
                    }}
                    onDrop={(e) => handleDropTask(e, proj.id)}
                    className="flex items-center gap-3 rounded-lg bg-nb-panel-2 border border-nb-border px-3.5 py-3 transition-all duration-150 hover:border-nb-border hover:bg-nb-panel"
                  >
                    <div
                      className="size-2.5 rounded-full shrink-0"
                      style={{ background: proj.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-nb-text">{proj.name}</div>
                      <div className="text-xs text-nb-muted">
                        {proj.taskIds.length} task{proj.taskIds.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteProject(proj.id)}
                      className="appearance-none bg-transparent border-none text-nb-muted text-lg cursor-pointer px-1.5 py-0.5 leading-none hover:text-nb-danger transition-colors"
                    >
                      ×
                    </button>
                  </div>
                </Fragment>
              ))}
            </div>
          </ContentCard>
        )}

        {showCreateProject && (
          <>
            {/* biome-ignore lint/a11y/noStaticElementInteractions: Modal overlay dismisses when clicking outside the dialog. */}
            <div
              className="fixed inset-0 z-[300] bg-black/50 flex items-center justify-center"
              onClick={(e) => {
                if (e.target !== e.currentTarget) return
                setShowCreateProject(false)
                setPendingProjectTaskId(null)
                setCreateProjectName('')
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setShowCreateProject(false)
                  setPendingProjectTaskId(null)
                  setCreateProjectName('')
                }
              }}
              role="presentation"
            >
              <div className="bg-nb-bg border border-nb-border rounded-[14px] p-6 w-[340px] flex flex-col gap-3 shadow-nb">
                <div className="text-base font-semibold text-nb-text">New Project</div>
                {pendingProjectTaskId && (
                  <div className="text-xs text-nb-muted">Task will be added to this project</div>
                )}
                <input
                  className="appearance-none bg-nb-code-bg border border-nb-border rounded-lg px-3 py-2.5 text-nb-text text-sm font-inherit outline-none focus:border-nb-accent-2"
                  placeholder="Project name…"
                  value={createProjectName}
                  onChange={(e) => setCreateProjectName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && createProjectName.trim())
                      void handleCreateProject(createProjectName.trim(), pendingProjectTaskId)
                  }}
                />
                <div className="flex justify-end gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateProject(false)
                      setPendingProjectTaskId(null)
                      setCreateProjectName('')
                    }}
                    className="appearance-none bg-transparent border border-nb-border rounded-lg text-nb-muted px-4 py-2 cursor-pointer font-inherit text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!createProjectName.trim()}
                    onClick={() =>
                      void handleCreateProject(createProjectName.trim(), pendingProjectTaskId)
                    }
                    className="appearance-none bg-nb-accent-2 border-none rounded-lg text-white px-4 py-2 cursor-pointer font-inherit text-xs font-medium disabled:opacity-40 disabled:cursor-default"
                  >
                    Create
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
