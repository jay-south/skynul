use std::path::PathBuf;

use crate::agent::harness::exec;
use crate::agent::skills::{discover_skills, format_skills_block};

const BASE_AGENT: &str = include_str!("agent.txt");

pub struct PromptContext {
    pub append: String,
}

pub fn config_dir() -> PathBuf {
    if let Ok(dir) = std::env::var("SKYNUL_CONFIG_DIR") {
        if !dir.is_empty() {
            return PathBuf::from(dir);
        }
    }
    exec::tool_base_dir().join(".config/skynul")
}

fn load_system_md() -> Option<String> {
    let candidates = [
        config_dir().join("SYSTEM.md"),
        exec::tool_base_dir().join("SYSTEM.md"),
        exec::tool_base_dir().join(".agents/SYSTEM.md"),
    ];
    for path in candidates {
        if path.is_file() {
            return std::fs::read_to_string(&path).ok().filter(|s| !s.trim().is_empty());
        }
    }
    None
}

pub fn build_agent_system(ctx: &PromptContext) -> String {
    let mut parts = vec![BASE_AGENT.to_string()];

    if let Some(system_md) = load_system_md() {
        parts.push(format!("\n\n## SYSTEM.md\n{system_md}"));
    }

    let skills = discover_skills(&exec::tool_base_dir());
    let skills_block = format_skills_block(&skills);
    if !skills_block.is_empty() {
        parts.push(format!("\n\n{skills_block}"));
    }

    if !ctx.append.trim().is_empty() {
        parts.push(format!("\n\n## User instructions\n{}", ctx.append.trim()));
    }

    parts.join("")
}
