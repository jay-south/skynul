export const IPC = {
  ping: 'netbot:app:ping',
  getPolicy: 'netbot:policy:get',
  pickWorkspace: 'netbot:workspace:pick',
  setCapability: 'netbot:policy:setCapability',
  setTheme: 'netbot:policy:setTheme',
  setOpenAIModel: 'netbot:provider:openai:setModel',
  setOpenAIApiKey: 'netbot:provider:openai:setApiKey',
  hasOpenAIApiKey: 'netbot:provider:openai:hasApiKey',
  chatSend: 'netbot:chat:send',
  openExternal: 'netbot:app:openExternal',
  authOpen: 'netbot:auth:open',
  fsReadText: 'netbot:fs:readText',
  fsWriteText: 'netbot:fs:writeText',
  chatgptOAuthStart: 'netbot:chatgpt:oauth:start',
  chatgptHasAuth: 'netbot:chatgpt:hasAuth',
  chatgptSignOut: 'netbot:chatgpt:signOut',
  setActiveProvider: 'netbot:provider:setActive',
  windowMinimize: 'netbot:window:minimize',
  windowMaximize: 'netbot:window:maximize',
  windowClose: 'netbot:window:close',

  // ── Task Agent ────────────────────────────────────────────────────────
  taskCreate: 'netbot:task:create',
  taskApprove: 'netbot:task:approve',
  taskCancel: 'netbot:task:cancel',
  taskPause: 'netbot:task:pause',
  taskResume: 'netbot:task:resume',
  taskGet: 'netbot:task:get',
  taskList: 'netbot:task:list'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
