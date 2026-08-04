use crate::models::policy::PolicyRecord;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum PolicyGate {
    FsRead,
    FsWrite,
    CmdRun,
    NetHttp,
}

impl PolicyGate {
    pub fn as_id(&self) -> &'static str {
        match self {
            PolicyGate::FsRead => "fs.read",
            PolicyGate::FsWrite => "fs.write",
            PolicyGate::CmdRun => "cmd.run",
            PolicyGate::NetHttp => "net.http",
        }
    }

    pub fn settings_label(&self) -> &'static str {
        match self {
            PolicyGate::FsRead => "fs.read",
            PolicyGate::FsWrite => "fs.write",
            PolicyGate::CmdRun => "cmd.run",
            PolicyGate::NetHttp => "net.http",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ModeSource {
    Inferred,
    Manual,
}

impl ModeSource {
    pub fn as_str(&self) -> &'static str {
        match self {
            ModeSource::Inferred => "inferred",
            ModeSource::Manual => "manual",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "inferred" => Some(ModeSource::Inferred),
            "manual" => Some(ModeSource::Manual),
            _ => None,
        }
    }
}

pub fn parse_create_mode(mode: Option<&str>) -> (String, &'static str) {
    match mode {
        None | Some("") | Some("auto") => (String::new(), ModeSource::Inferred.as_str()),
        Some(m) => TaskMode::parse(m)
            .map(|parsed| (parsed.as_str().to_string(), ModeSource::Manual.as_str()))
            .unwrap_or((String::new(), ModeSource::Inferred.as_str())),
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TaskMode {
    Conversational,
    Agent,
}

impl TaskMode {
    pub fn as_str(&self) -> &'static str {
        match self {
            TaskMode::Conversational => "conversational",
            TaskMode::Agent => "agent",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "conversational" => Some(TaskMode::Conversational),
            "agent" | "shell" | "office" | "browser" | "trading" => Some(TaskMode::Agent),
            _ => None,
        }
    }

    pub fn required_policies(&self) -> Vec<PolicyGate> {
        match self {
            TaskMode::Conversational => vec![],
            TaskMode::Agent => vec![PolicyGate::CmdRun, PolicyGate::FsRead],
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PermissionLevel {
    Deny,
    Ask,
    Allow,
}

impl PermissionLevel {
    pub fn parse_value(value: &serde_json::Value) -> Self {
        if let Some(enabled) = value.as_bool() {
            return if enabled {
                Self::Allow
            } else {
                Self::Deny
            };
        }
        if value.as_str() == Some("ask") {
            return Self::Ask;
        }
        Self::Deny
    }
}

#[derive(Debug, Clone)]
pub struct ParsedPolicy {
    pub fs_read: PermissionLevel,
    pub fs_write: PermissionLevel,
    pub cmd_run: PermissionLevel,
    pub net_http: PermissionLevel,
}

impl ParsedPolicy {
    pub fn from_record(record: &PolicyRecord) -> Self {
        let caps: serde_json::Value =
            serde_json::from_str(&record.capabilities).unwrap_or_default();
        let get = |key: &str| {
            caps.get(key)
                .map(PermissionLevel::parse_value)
                .unwrap_or(PermissionLevel::Deny)
        };
        Self {
            fs_read: get("fs.read"),
            fs_write: get("fs.write"),
            cmd_run: get("cmd.run"),
            net_http: get("net.http"),
        }
    }

    pub fn level(&self, gate: &PolicyGate) -> PermissionLevel {
        match gate {
            PolicyGate::FsRead => self.fs_read,
            PolicyGate::FsWrite => self.fs_write,
            PolicyGate::CmdRun => self.cmd_run,
            PolicyGate::NetHttp => self.net_http,
        }
    }

    pub fn satisfies(&self, gate: &PolicyGate) -> bool {
        !matches!(self.level(gate), PermissionLevel::Deny)
    }
}

#[derive(Debug, Clone)]
pub struct PolicyError {
    pub gate: PolicyGate,
    pub mode: TaskMode,
}

impl PolicyError {
    pub fn user_message(&self) -> String {
        format!(
            "No pude completar esta tarea.\nNecesitás habilitar {} en Settings → Permissions.",
            self.gate.settings_label()
        )
    }
}

pub fn check_policy(mode: &TaskMode, policy: &ParsedPolicy) -> Result<(), PolicyError> {
    for gate in mode.required_policies() {
        if !policy.satisfies(&gate) {
            return Err(PolicyError {
                gate,
                mode: *mode,
            });
        }
    }
    Ok(())
}
