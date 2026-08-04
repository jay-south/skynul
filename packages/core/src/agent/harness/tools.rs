use serde_json::json;

use super::exec::{self, EditPatch};
use crate::policy::{ParsedPolicy, PolicyGate};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ToolName {
    Bash,
    Read,
    Edit,
    Write,
    Ls,
    Find,
    Grep,
    Fetch,
}

impl ToolName {
    pub fn parse(name: &str) -> Option<Self> {
        match name {
            "bash" => Some(ToolName::Bash),
            "read" => Some(ToolName::Read),
            "edit" => Some(ToolName::Edit),
            "write" => Some(ToolName::Write),
            "ls" => Some(ToolName::Ls),
            "find" => Some(ToolName::Find),
            "glob" => Some(ToolName::Find),
            "grep" => Some(ToolName::Grep),
            "fetch" => Some(ToolName::Fetch),
            _ => None,
        }
    }

    pub fn required_gates(self) -> &'static [PolicyGate] {
        match self {
            ToolName::Bash => &[PolicyGate::CmdRun],
            ToolName::Read | ToolName::Ls | ToolName::Find | ToolName::Grep => &[PolicyGate::FsRead],
            ToolName::Edit | ToolName::Write => &[PolicyGate::FsRead, PolicyGate::FsWrite],
            ToolName::Fetch => &[PolicyGate::NetHttp],
        }
    }

    pub fn requires_confirmation(self) -> bool {
        matches!(
            self,
            ToolName::Bash | ToolName::Edit | ToolName::Write | ToolName::Fetch
        )
    }
}

pub fn openai_definitions() -> Vec<serde_json::Value> {
    vec![
        tool(
            "read",
            "Read a file from disk.",
            json!({
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "File path (supports ~)" },
                    "offset": { "type": "integer", "description": "1-based start line (optional)" },
                    "limit": { "type": "integer", "description": "Max lines to read (optional)" }
                },
                "required": ["path"]
            }),
        ),
        tool(
            "bash",
            "Run a shell command. Use for system inspection and CLI tools — prefer native tools for file operations.",
            json!({
                "type": "object",
                "properties": {
                    "command": { "type": "string", "description": "Shell command to run" },
                    "cwd": { "type": "string", "description": "Working directory (optional, supports ~)" }
                },
                "required": ["command"]
            }),
        ),
        tool(
            "edit",
            "Edit a file using exact text replacement. Each edits[].oldText must match a unique, non-overlapping region of the original file. Prefer edit over write for small changes.",
            json!({
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "File path (supports ~)" },
                    "edits": {
                        "type": "array",
                        "description": "One or more targeted replacements, each matched against the original file.",
                        "items": {
                            "type": "object",
                            "properties": {
                                "oldText": { "type": "string", "description": "Exact text to replace (must be unique in the file)" },
                                "newText": { "type": "string", "description": "Replacement text" }
                            },
                            "required": ["oldText", "newText"]
                        }
                    }
                },
                "required": ["path", "edits"]
            }),
        ),
        tool(
            "write",
            "Create or overwrite a file with full content. Prefer edit for small changes to existing files.",
            json!({
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "File path (supports ~)" },
                    "content": { "type": "string", "description": "Full file content" }
                },
                "required": ["path", "content"]
            }),
        ),
        tool(
            "find",
            "Locate files by glob pattern on filename (e.g. '*.pdf', '*.mp3', '**/*.ts'). Use this — not grep — when searching for files by type, extension, or name. Respects .gitignore.",
            json!({
                "type": "object",
                "properties": {
                    "pattern": { "type": "string", "description": "Glob on filename e.g. '*.mp3' or 'src/**/*.rs'" },
                    "path": { "type": "string", "description": "Directory to search (supports ~, default HOME)" },
                    "limit": { "type": "integer", "description": "Maximum number of results (default 1000)" }
                },
                "required": ["pattern"]
            }),
        ),
        tool(
            "grep",
            "Search text inside file contents using a regex. For finding files by extension or filename, use find instead — grep does not search filenames.",
            json!({
                "type": "object",
                "properties": {
                    "pattern": { "type": "string", "description": "Regex to match inside file contents" },
                    "path": { "type": "string", "description": "File or directory to search (supports ~; prefer a narrow directory, default HOME)" }
                },
                "required": ["pattern"]
            }),
        ),
        tool(
            "ls",
            "List files and directories in a path.",
            json!({
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "Directory path (supports ~, default .)" }
                },
                "required": []
            }),
        ),
        tool(
            "fetch",
            "Fetch a URL over HTTP(S). Returns status, headers summary, and text body.",
            json!({
                "type": "object",
                "properties": {
                    "url": { "type": "string", "description": "HTTP or HTTPS URL" }
                },
                "required": ["url"]
            }),
        ),
    ]
}

pub fn requires_confirmation(tool: ToolName) -> bool {
    tool.requires_confirmation()
}

fn tool(name: &str, description: &str, parameters: serde_json::Value) -> serde_json::Value {
    json!({
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": parameters
        }
    })
}

pub fn check_permission(tool: ToolName, policy: &ParsedPolicy) -> Result<(), String> {
    for gate in tool.required_gates() {
        if !policy.satisfies(gate) {
            return Err(format!(
                "Necesitás habilitar {} en Settings → Permissions.",
                gate.settings_label()
            ));
        }
    }
    Ok(())
}

pub async fn execute(tool: ToolName, args: &serde_json::Value) -> Result<String, String> {
    match tool {
        ToolName::Bash => {
            let command = arg_str(args, "command")?;
            let cwd = args.get("cwd").and_then(|v| v.as_str()).map(str::to_string);
            exec::bash(&command, cwd.as_deref()).await
        }
        ToolName::Read => {
            let path = arg_str(args, "path")?;
            let offset = args.get("offset").and_then(|v| v.as_i64());
            let limit = args.get("limit").and_then(|v| v.as_i64());
            exec::read_file(&path, offset, limit).await
        }
        ToolName::Edit => {
            let path = arg_str(args, "path")?;
            let edits = parse_edit_patches(args)?;
            exec::edit_file(path, &edits).await
        }
        ToolName::Write => {
            let path = arg_str(args, "path")?;
            let content = arg_str(args, "content")?;
            exec::write_file(&path, &content).await
        }
        ToolName::Ls => {
            let path = args
                .get("path")
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty())
                .unwrap_or(".");
            exec::ls(path).await
        }
        ToolName::Find => {
            let pattern = arg_str(args, "pattern")?;
            let path = args
                .get("path")
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty())
                .unwrap_or(".");
            let limit = args.get("limit").and_then(|v| v.as_i64());
            exec::find(pattern, path, limit).await
        }
        ToolName::Grep => {
            let pattern = arg_str(args, "pattern")?;
            let path = args
                .get("path")
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty())
                .unwrap_or(".");
            exec::grep(pattern, path).await
        }
        ToolName::Fetch => {
            let url = arg_str(args, "url")?;
            exec::fetch_url(url).await
        }
    }
}

fn parse_edit_patches(args: &serde_json::Value) -> Result<Vec<EditPatch>, String> {
    let mut raw_edits = args.get("edits").cloned().unwrap_or(json!([]));
    if let Some(text) = raw_edits.as_str() {
        raw_edits = serde_json::from_str(text).unwrap_or(json!([]));
    }

    let mut patches = Vec::new();
    if let Some(items) = raw_edits.as_array() {
        for item in items {
            let old_text = item
                .get("oldText")
                .and_then(|v| v.as_str())
                .ok_or("[Error: each edit requires oldText]")?
                .to_string();
            let new_text = item
                .get("newText")
                .and_then(|v| v.as_str())
                .ok_or("[Error: each edit requires newText]")?
                .to_string();
            patches.push(EditPatch { old_text, new_text });
        }
    }

    if patches.is_empty() {
        let old_text = args.get("oldText").and_then(|v| v.as_str());
        let new_text = args.get("newText").and_then(|v| v.as_str());
        if let (Some(old_text), Some(new_text)) = (old_text, new_text) {
            patches.push(EditPatch {
                old_text: old_text.to_string(),
                new_text: new_text.to_string(),
            });
        }
    }

    if patches.is_empty() {
        return Err("[Error: edits must contain at least one replacement]".into());
    }

    Ok(patches)
}

fn arg_str<'a>(args: &'a serde_json::Value, key: &str) -> Result<&'a str, String> {
    args.get(key)
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| format!("missing or empty argument: {key}"))
}
