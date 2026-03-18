# Migración main.css → Tailwind

Estado actual de la migración de estilos desde `src/renderer/src/assets/main.css` hacia Tailwind y componentes.

---

## Entrada global

- **`src/renderer/src/main.tsx`** importa `./assets/main.css` (única entrada global).
- **`main.css`** importa `tailwindcss`, `tw-animate-css`, `shadcn` y `base.css`; el resto son estilos de layout/UI que se van migrando por bloques.

---

## Bloques ya migrados y eliminados de main.css

### 1. Botones genéricos y toggles (`.btn*` / `.cap*`)

**Migrado a:**

- **`src/renderer/src/components/ui/button.tsx`**  
  `<Button variant="default|filled|secondary|ghost" size="default|small" />`
- Toggles de capacidades/schedules/channels: Tailwind inline + `cn` (ej. `w-[44px] h-[26px] ... translate-x-[18px]`).

**Archivos que usan `Button` en lugar de `.btn`/`.btnSecondary`:**

- `layouts/root-layout.tsx`
- `components/ChatFeed.tsx`
- `components/SchedulePanel.tsx`
- `components/TaskDashboard.tsx`
- `components/TaskComposer.tsx`
- `components/TaskDetailView.tsx`
- `components/TaskApprovalDialog.tsx`
- `components/UpdateSettings.tsx`
- `components/AuthModal.tsx`
- `pages/settings/general-settings-page.tsx`
- `pages/settings/providers-settings-page.tsx`
- `pages/settings/computer-settings-page.tsx`
- `pages/settings/skills-settings-page.tsx`
- `components/ChannelSettings.tsx`

**Eliminado de main.css:**

- `.btn`, `.btn:hover`, `.btn:active`
- `.btnFilled`, `.btnFilled:hover`
- `.btnSecondary` (+ estados)
- `.btnSmall`
- `.capList`, `.cap`, `.capTitle`, `.capDesc`, `.capToggle`, `.capKnob`, `.cap.on ...`

---

### 2. Root layout (ventana + sidebar)

**Antes:** `.layout`, `.layout.maximized`, `#root:has(.layout.maximized)`, `.titleBar`, `.winBtn`, `.sidebar`, `.sidebarNav`, `.sidebarNavItem*`, `.sidebarBrand`, `.sidebarContent`, `.profileBtn`, `.profileAvatar`, etc.

**Ahora:**

- **`src/renderer/src/layouts/root-layout.tsx`** usa solo Tailwind + `cn`:
  - Contenedor raíz: `grid grid-cols-[320px_1fr] grid-rows-[38px_1fr] ...`
  - Maximize: `isMaximized` + `useEffect` que ajusta `#root.style.padding`
  - Titlebar: flex + estilos inline con `CSSProperties` para `WebkitAppRegion`
  - Sidebar: `max-[860px]:hidden`, `border-r`, `backdrop-blur`, etc.
  - NavLinks: clases Tailwind que replican `sidebarNavItem` (hover, active)
  - Botón “Sign In”: `<Button>` + Tailwind inline

**Eliminado de main.css:**

- `#root:has(.layout.maximized)` y bloque `.layout` / `.layout.maximized`
- `.titleBar`, `.winBtn*`, `.sidebar`, `.sidebarTabs`, `.sidebarBrand`, `.sidebarContent`
- Bloque `.sidebarNav` + `.sidebarNavItem*`
- `.profileBtn`, `.profileAvatar`

---

### 3. Proyectos (ProjectsPage)

**Antes:** `projectsPlaceholder*`, `projectModal*`, `projectsListPanel`, `projectCard*` solo en main.css.

**Ahora:**

- **`src/renderer/src/pages/projects-page.tsx`** usa Tailwind inline:
  - Placeholder vacío: `flex flex-col items-center ...` + `IconFolder`
  - Lista: `w-full max-w-[480px] flex flex-col gap-[8px] ...`
  - Cards: Tailwind para fondo/borde/hover, color-dot, tipografía
  - Modal: overlay `fixed inset-0 ...`, card con `rounded`, `shadow`, inputs y botones con clases utilitarias

**Eliminado de main.css:**

- `.projectsPlaceholder`, `.projectsPlaceholderIcon`, `.projectsPlaceholderTitle`, `.projectsPlaceholderSub`
- `.projectModalOverlay`, `.projectModalBackdrop`, `.projectModalCard`, `.projectModalTitle`, `.projectModalSub`, `.projectModalInput` (+focus), `.projectModalActions`, `.projectModalCancel`, `.projectModalSave` (+disabled)
- `.projectsListPanel`, `.projectsListHeader`, `.projectsListTitle`
- `.projectCard*` (color, body, name, meta, delete + hover)

---

## Pendiente de migrar (dependen de main.css)

Para continuar la migración, estos bloques siguen usando clases de main.css:

| Área | Clases típicas | Archivos principales |
|------|----------------|----------------------|
| **Dashboard / tareas** | `dash*`, `agentCard*`, `agentPill`, `agentSub*`, `taskDetail*` | `TaskDashboard.tsx`, `TaskDetailView.tsx` |
| **Feed de chat / pasos** | `chatFeed`, `feedBubble*`, `feedStep*`, `feedCaps*`, `feedStatus` | `ChatFeed.tsx`, `CollectiveChatFeed.tsx` |
| **Schedule UI** | `sched*` (cards, toggles, history) | `SchedulePanel.tsx`, `scheduled-page.tsx`, `schedule-detail-page.tsx` |
| **Task composer / templates** | `taskComposer*`, `taskCap*`, `seg*` | `TaskComposer.tsx`, `TaskTemplates.tsx` |
| **Modales / inputs** | `modal*`, `apiKeyInput`, `pathBox`, `settings*` | Varios settings y modales |

---

## Flujo de trabajo

1. Migrar un bloque: reemplazar clases de main.css por Tailwind (o componentes) en los TSX.
2. Borrar del main.css solo las reglas ya no referenciadas en ningún TSX.
3. Verificar con `pnpm -s typecheck:web`.

---

## Estado técnico

- `pnpm -s typecheck:web` pasa.
- No hay referencias en TSX a las clases listadas como “eliminadas” arriba.
