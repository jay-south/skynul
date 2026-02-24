import type { LanguageCode } from '../../shared/policy'

const MESSAGES = {
  en: {
    sidebar_chats: 'Chats',
    sidebar_tasks: 'Tasks',

    chats_title: 'Chats',
    chats_new: 'New',
    chats_new_title: 'New chat',
    chats_messages_count: '{count} messages',

    tasks_title: 'Tasks',
    tasks_new: 'New',
    tasks_cancel: 'Cancel',
    tasks_new_from_template: 'Start task',
    tasks_templates_title: 'Pick a task agent',
    tasks_templates_subtitle: 'Choose a template, then write what you want it to do.',

    task_template_daily_title: 'Daily Tasks Agent',
    task_template_daily_desc: 'Routines, reminders, follow-ups, and planning.',
    task_template_trading_title: 'Trading Agent',
    task_template_trading_desc: 'Research, notes, checklists, and trade journaling.',
    task_template_chat_title: 'Chat Agent',
    task_template_chat_desc: 'Talk-through tasks and structured Q&A.',
    task_template_custom_title: 'Custom Agent',
    task_template_custom_desc: 'Start from scratch with your own prompt.',

    task_composer_title_daily: 'Daily Tasks Agent',
    task_composer_title_trading: 'Trading Agent',
    task_composer_title_chat: 'Chat Agent',
    task_composer_title_custom: 'Custom Agent',
    task_composer_prompt_label: 'Task prompt',
    task_composer_caps_label: 'Permissions',
    task_composer_saved_label: 'Saved prompts',
    meta_steps_count: '{count} steps',

    common_delete: 'Delete',
    common_close: 'Close',
    common_cancel: 'Cancel',

    workspace_none: 'No workspace',

    composer_placeholder: 'Ask anything. Files and images work too.',
    composer_placeholder_empty: 'Ask anything. Files and images work too.',
    chat_welcome: 'Hey there! Nice to see you.',
    chat_greeting_empty: 'Hey there! Good to see you again.',
    composer_note: 'Enter to send · Shift+Enter new line.',
    composer_attach_label: 'Attach file',

    settings_title: 'Settings',
    settings_open_title: 'Settings',
    settings_workspace: 'Workspace',
    settings_pick_workspace: 'Pick workspace',
    settings_workspace_hint: 'Folder the assistant can read and work in. Pick one to get started.',
    settings_capabilities: 'Capabilities',
    settings_theme: 'Theme',
    settings_language: 'Language',
    settings_account: 'Account',
    settings_chatgpt_pro: 'ChatGPT Pro',

    cap_fs_read_title: 'Read Files',
    cap_fs_read_desc: 'Allow reading text files inside the workspace.',
    cap_fs_write_title: 'Write Files',
    cap_fs_write_desc: 'Allow writing text files inside the workspace.',
    cap_cmd_run_title: 'Run Commands',
    cap_cmd_run_desc: 'Allow running approved commands (not wired yet).',
    cap_net_http_title: 'Network Access',
    cap_net_http_desc: 'Allow outbound HTTP requests (not wired yet).',

    theme_system: 'System',
    theme_light: 'Light',
    theme_dark: 'Dark',

    account_status: 'Status',
    account_connected_as: 'Connected as {email}.',
    account_connected: 'Connected.',
    account_not_connected: 'Not connected.',
    account_supabase_not_configured: 'Supabase not configured.',
    account_sign_out: 'Sign out',
    account_sign_in_google: 'Sign in with Google',
    account_network_cap_hint: 'Network capability must be enabled to chat.',

    chatgpt_status_connected: 'Connected — using your ChatGPT Pro subscription.',
    chatgpt_status_not_connected: 'Not connected.',
    chatgpt_disconnect: 'Disconnect',
    chatgpt_connect: 'Connect ChatGPT Pro',
    chatgpt_connecting: 'Connecting...',
    chatgpt_hint: 'Opens a browser window to log in with your OpenAI account. No API key needed.',

    settings_provider: 'AI Provider',
    provider_chatgpt: 'ChatGPT Pro',
    provider_openai: 'OpenAI',
    provider_claude: 'Claude',
    provider_deepseek: 'Deepseek',
    provider_requires_account: 'Sign in with Google to use this provider.',
    provider_connected: 'Connected',

    settings_deepseek_key: 'DeepSeek API Key',
    deepseek_key_configured: 'API key configured',
    deepseek_key_get_from: 'Get your API key from platform.deepseek.com',

    settings_kimi_key: 'Kimi API Key',
    kimi_key_configured: 'API key configured',
    kimi_key_get_from: 'Get your API key from api.kimi.com (Kimi for Coding)',

    settings_claude_key: 'Claude API Key',
    claude_key_configured: 'API key configured',
    claude_key_get_from: 'Get your API key from console.anthropic.com',

    provider_api_key_placeholder: 'Paste your API key',
    provider_api_key_save: 'Save',

    tasks_empty_sidebar: 'No tasks yet. Click "New" to create one.',
    tasks_prompt_placeholder: 'Describe what you want the agent to do...',
    tasks_save_prompt: 'Save prompt',
    tasks_saved: 'Saved!',
    tasks_create: 'Create Task',
    tasks_remove_saved_prompt_aria: 'Remove saved prompt',

    task_status_pending: 'Pending',
    task_status_approved: 'Approved',
    task_status_running: 'Running',
    task_status_done: 'Done',
    task_status_completed: 'Completed',
    task_status_failed: 'Failed',
    task_status_cancelled: 'Cancelled',
    task_status_pending_approval: 'Pending Approval',

    task_dropdown_save_prompt: 'Save prompt',
    task_dropdown_delete: 'Delete',


    task_approve_title: 'Approve Task',
    task_approve_task: 'Task',
    task_approve_caps_requested: 'Capabilities Requested',
    task_approve_limits: 'Limits',
    task_approve_limits_text: 'Max {maxSteps} steps · Timeout {timeoutS}s',
    task_approve_run: 'Approve & Run',

    task_stop: 'Stop Task',
    task_screenshot_alt: 'Latest screenshot',
    task_screenshot_approve_to_start: 'Approve the task to start',
    task_screenshot_starting: 'Starting...',
    task_screenshot_failed: 'Task failed',
    task_screenshot_none: 'No screenshots',

    task_empty_main: 'Select a task from the sidebar or create a new one.',

    step_log_waiting: 'Waiting for first step...',

    action_click: 'Click',
    action_double_click: 'Double Click',
    action_type: 'Type',
    action_key: 'Key',
    action_scroll: 'Scroll',
    action_move: 'Move',
    action_launch: 'Launch',
    action_wait: 'Wait',
    action_done: 'Done',
    action_failed: 'Failed',

    step_click_at: 'Click ({x}, {y}) {button}',
    step_double_click_at: 'Double click ({x}, {y})',
    step_type_text: 'Type "{text}"',
    step_key_combo: 'Key: {combo}',
    step_scroll_dir_at: 'Scroll {dir} at ({x}, {y})',
    step_move_to: 'Move to ({x}, {y})',
    step_launch_app: 'Launch: {app}',
    step_wait_ms: 'Wait {ms}ms',
    step_done_summary: 'Done: {summary}',
    step_failed_reason: 'Failed: {reason}',

    new_chat_title: 'New chat'
  },
  es: {
    sidebar_chats: 'Chats',
    sidebar_tasks: 'Tareas',

    chats_title: 'Chats',
    chats_new: 'Nuevo',
    chats_new_title: 'Nuevo chat',
    chats_messages_count: '{count} mensajes',

    tasks_title: 'Tareas',
    tasks_new: 'Nuevo',
    tasks_cancel: 'Cancelar',
    tasks_new_from_template: 'Comenzar tarea',
    tasks_templates_title: 'Elegí un agente',
    tasks_templates_subtitle: 'Elegí una plantilla y después escribí qué querés que haga.',

    task_template_daily_title: 'Agente de tareas diarias',
    task_template_daily_desc: 'Rutinas, recordatorios, seguimientos y planificación.',
    task_template_trading_title: 'Agente de trading',
    task_template_trading_desc: 'Research, notas, checklists y journal de trades.',
    task_template_chat_title: 'Agente de chats',
    task_template_chat_desc: 'Pensar en voz alta y Q&A ordenado.',
    task_template_custom_title: 'Agente personalizado',
    task_template_custom_desc: 'Arrancá de cero con tu propio prompt.',

    task_composer_title_daily: 'Agente de tareas diarias',
    task_composer_title_trading: 'Agente de trading',
    task_composer_title_chat: 'Agente de chats',
    task_composer_title_custom: 'Agente personalizado',
    task_composer_prompt_label: 'Prompt de la tarea',
    task_composer_caps_label: 'Permisos',
    task_composer_saved_label: 'Prompts guardados',
    meta_steps_count: '{count} pasos',

    common_delete: 'Borrar',
    common_close: 'Cerrar',
    common_cancel: 'Cancelar',

    workspace_none: 'Sin workspace',

    composer_placeholder: 'Preguntá lo que quieras. Archivos e imágenes también.',
    composer_placeholder_empty: 'Preguntá lo que quieras. Archivos e imágenes también.',
    chat_welcome: '¡Hola! Qué bueno verte.',
    chat_greeting_empty: '¡Hola! Qué bueno verte de nuevo.',
    composer_note: 'Enter para enviar · Shift+Enter nueva linea.',
    composer_attach_label: 'Adjuntar archivo',

    settings_title: 'Configuracion',
    settings_open_title: 'Configuracion',
    settings_workspace: 'Workspace',
    settings_pick_workspace: 'Elegir workspace',
    settings_workspace_hint: 'Carpeta en la que el asistente puede leer y trabajar. Elegí una para empezar.',
    settings_capabilities: 'Capabilities',
    settings_theme: 'Tema',
    settings_language: 'Idioma',
    settings_account: 'Cuenta',
    settings_chatgpt_pro: 'ChatGPT Pro',

    cap_fs_read_title: 'Leer archivos',
    cap_fs_read_desc: 'Permite leer archivos de texto dentro del workspace.',
    cap_fs_write_title: 'Escribir archivos',
    cap_fs_write_desc: 'Permite escribir archivos de texto dentro del workspace.',
    cap_cmd_run_title: 'Ejecutar comandos',
    cap_cmd_run_desc: 'Permite ejecutar comandos aprobados (todavia no esta cableado).',
    cap_net_http_title: 'Acceso a red',
    cap_net_http_desc: 'Permite requests HTTP salientes (todavia no esta cableado).',

    theme_system: 'Sistema',
    theme_light: 'Claro',
    theme_dark: 'Oscuro',

    account_status: 'Estado',
    account_connected_as: 'Conectado como {email}.',
    account_connected: 'Conectado.',
    account_not_connected: 'No conectado.',
    account_supabase_not_configured: 'Supabase no esta configurado.',
    account_sign_out: 'Cerrar sesion',
    account_sign_in_google: 'Iniciar sesion con Google',
    account_network_cap_hint: 'Para chatear, tenes que habilitar la capability de red.',

    chatgpt_status_connected: 'Conectado — usando tu suscripcion de ChatGPT Pro.',
    chatgpt_status_not_connected: 'No conectado.',
    chatgpt_disconnect: 'Desconectar',
    chatgpt_connect: 'Conectar ChatGPT Pro',
    chatgpt_connecting: 'Conectando...',
    chatgpt_hint: 'Abre el navegador para loguearte con tu cuenta de OpenAI. No necesitas API key.',

    settings_provider: 'Proveedor de IA',
    provider_chatgpt: 'ChatGPT Pro',
    provider_openai: 'OpenAI',
    provider_claude: 'Claude',
    provider_deepseek: 'Deepseek',
    provider_requires_account: 'Inicia sesion con Google para usar este proveedor.',
    provider_connected: 'Conectado',

    settings_deepseek_key: 'Clave API de DeepSeek',
    deepseek_key_configured: 'Clave API configurada',
    deepseek_key_get_from: 'Obtén tu clave en platform.deepseek.com',

    settings_kimi_key: 'Clave API de Kimi',
    kimi_key_configured: 'Clave API configurada',
    kimi_key_get_from: 'Obtén tu clave en api.kimi.com (Kimi for Coding)',

    settings_claude_key: 'Clave API de Claude',
    claude_key_configured: 'Clave API configurada',
    claude_key_get_from: 'Obtén tu clave en console.anthropic.com',

    provider_api_key_placeholder: 'Pega tu clave API',
    provider_api_key_save: 'Guardar',

    tasks_empty_sidebar: 'Todavia no hay tareas. Toca "Nuevo" para crear una.',
    tasks_prompt_placeholder: 'Describe lo que queres que haga el agente...',
    tasks_save_prompt: 'Guardar prompt',
    tasks_saved: 'Guardado!',
    tasks_create: 'Crear tarea',
    tasks_remove_saved_prompt_aria: 'Eliminar prompt guardado',

    task_status_pending: 'Pendiente',
    task_status_approved: 'Aprobada',
    task_status_running: 'Ejecutando',
    task_status_done: 'Listo',
    task_status_completed: 'Completada',
    task_status_failed: 'Fallo',
    task_status_cancelled: 'Cancelada',
    task_status_pending_approval: 'Pendiente de aprobacion',

    task_dropdown_save_prompt: 'Guardar prompt',
    task_dropdown_delete: 'Borrar',

    task_approve_title: 'Aprobar tarea',
    task_approve_task: 'Tarea',
    task_approve_caps_requested: 'Capabilities solicitadas',
    task_approve_limits: 'Limites',
    task_approve_limits_text: 'Max {maxSteps} pasos · Timeout {timeoutS}s',
    task_approve_run: 'Aprobar y ejecutar',

    task_stop: 'Frenar tarea',
    task_screenshot_alt: 'Captura mas reciente',
    task_screenshot_approve_to_start: 'Aproba la tarea para arrancar',
    task_screenshot_starting: 'Arrancando...',
    task_screenshot_failed: 'La tarea fallo',
    task_screenshot_none: 'Sin capturas',

    task_empty_main: 'Selecciona una tarea en el panel o crea una nueva.',

    step_log_waiting: 'Esperando el primer paso...',

    action_click: 'Click',
    action_double_click: 'Doble click',
    action_type: 'Escribir',
    action_key: 'Tecla',
    action_scroll: 'Scroll',
    action_move: 'Mover',
    action_launch: 'Abrir',
    action_wait: 'Esperar',
    action_done: 'Listo',
    action_failed: 'Fallo',

    step_click_at: 'Click ({x}, {y}) {button}',
    step_double_click_at: 'Doble click ({x}, {y})',
    step_type_text: 'Escribir "{text}"',
    step_key_combo: 'Tecla: {combo}',
    step_scroll_dir_at: 'Scroll {dir} en ({x}, {y})',
    step_move_to: 'Mover a ({x}, {y})',
    step_launch_app: 'Abrir: {app}',
    step_wait_ms: 'Esperar {ms}ms',
    step_done_summary: 'Listo: {summary}',
    step_failed_reason: 'Fallo: {reason}',

    new_chat_title: 'Nuevo chat'
  }
} as const

export type MessageKey = keyof (typeof MESSAGES)['en']

export function t(
  lang: LanguageCode,
  key: MessageKey,
  vars?: Record<string, string | number>
): string {
  const table = MESSAGES[lang] ?? MESSAGES.en
  let s = (table[key] ?? MESSAGES.en[key]) as string
  if (!vars) return s
  for (const [k, v] of Object.entries(vars)) {
    s = s.replaceAll(`{${k}}`, String(v))
  }
  return s
}

export function speechLocale(lang: LanguageCode): string {
  return lang === 'es' ? 'es-AR' : 'en-US'
}
