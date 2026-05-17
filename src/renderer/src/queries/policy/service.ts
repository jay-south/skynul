import type { PolicyState } from "@skynul/shared";
import type {
  SetAutoApproveRequest,
  SetCapabilityRequest,
  SetLanguageRequest,
  SetProviderRequest,
  SetTaskMemoryRequest,
  SetThemeRequest,
} from "./types";
import { apiFetch } from "@/lib/api-fetch";

export async function fetchPolicy(): Promise<PolicyState> {
  return apiFetch("/policy");
}

export async function setLanguage(
  data: SetLanguageRequest,
): Promise<PolicyState> {
  return apiFetch("/policy/language", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function setTheme(data: SetThemeRequest): Promise<PolicyState> {
  return apiFetch("/policy/theme", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function setCapability(
  data: SetCapabilityRequest,
): Promise<PolicyState> {
  return apiFetch("/policy/capability", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function setTaskMemory(
  data: SetTaskMemoryRequest,
): Promise<PolicyState> {
  return apiFetch("/policy/task-memory", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function setAutoApprove(
  data: SetAutoApproveRequest,
): Promise<PolicyState> {
  return apiFetch("/policy/auto-approve", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function setProvider(
  data: SetProviderRequest,
): Promise<PolicyState> {
  return apiFetch("/policy/provider", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function pickWorkspace(): Promise<PolicyState> {
  return apiFetch("/policy/workspace", { method: "POST" });
}

export async function setOpenAIModel(data: {
  model: string;
}): Promise<PolicyState> {
  return apiFetch("/policy/provider/model", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}
