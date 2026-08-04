const CONVERSATIONAL: &str = include_str!("conversational.txt");

mod context;

pub use context::{build_agent_system, config_dir, PromptContext};

pub fn conversational() -> &'static str {
    CONVERSATIONAL
}
