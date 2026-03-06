import type { TaskCapabilityId, TaskContextRef, TaskIntent, TaskMode } from '../../../shared/task'
import type { ChainPlan } from '../task-envelope'

export type RouteV1Input = {
  displayPrompt: string
  requestedMode?: TaskMode
  userCapabilities: TaskCapabilityId[]
}

export type RouteV1Output = {
  intent: TaskIntent
  mode: TaskMode
  intentCaps: TaskCapabilityId[]
  chainPlan: ChainPlan
  contextRefs: TaskContextRef[]
  internalPrompt: string
}

export function routeV1(input: RouteV1Input): RouteV1Output {
  const displayPrompt = input.displayPrompt
  const norm = normalize(displayPrompt)
  const intent = classifyIntent(norm)

  const inferredMode = inferMode({ intent, requestedMode: input.requestedMode })
  const intentCaps = [...input.userCapabilities]

  const chainPlan: ChainPlan = { steps: [] }
  const contextRefs: TaskContextRef[] = []
  const internalPrompt = displayPrompt

  return {
    intent,
    mode: inferredMode,
    intentCaps,
    chainPlan,
    contextRefs,
    internalPrompt
  }
}

function inferMode(args: { intent: TaskIntent; requestedMode?: TaskMode }): TaskMode {
  if (args.requestedMode) return args.requestedMode
  if (args.intent === 'dev' || args.intent === 'infra') return 'code'
  return 'browser'
}

function classifyIntent(norm: string): TaskIntent {
  if (matchesAny(norm, INFRA_HINTS)) return 'infra'
  if (matchesAny(norm, DEV_HINTS)) return 'dev'
  if (matchesAny(norm, AUTOMATION_HINTS)) return 'automation'
  return 'unknown'
}

function normalize(s: string): string {
  return s.trim().toLowerCase()
}

function matchesAny(s: string, hints: readonly RegExp[]): boolean {
  return hints.some((re) => re.test(s))
}

const INFRA_HINTS = [
  /\bk8s\b|\bkubernetes\b/,
  /\bterraform\b|\baws\b|\bgcp\b|\bazure\b/,
  /\bnginx\b|\bdns\b|\bload balanc/,
  /\bdeploy\b|\bci\b|\bcd\b|\bpipeline\b/,
  /\bdocker\b|\bcontainer\b/,
  /\bserver\b|\binfra\b|\bdevops\b/
] as const

const DEV_HINTS = [
  /\btypescript\b|\bjavascript\b|\bnode\b/,
  /\breact\b|\bnext\b|\bvue\b|\bangular\b/,
  /\brefactor\b|\bbug\b|\bfix\b|\bimplement\b/,
  /\bunit test\b|\btest\b|\bvitest\b|\bjest\b/,
  /\bapi\b|\bfunction\b|\bclass\b|\bmodule\b/,
  /\btsc\b|\bcompile\b|\blint\b/
] as const

const AUTOMATION_HINTS = [
  /\bclick\b|\btype\b|\bscroll\b|\bopen\b/,
  /\bwebsite\b|\bbrowser\b|\bchrome\b|\bscrape\b/,
  /\bexcel\b|\bword\b|\bpowerpoint\b/,
  /\bslack\b|\bdiscord\b|\btelegram\b|\bwhatsapp\b|\bsignal\b/,
  /\bdownload\b|\bupload\b/
] as const
