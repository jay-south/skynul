use crate::api::types::{Project, ProjectSummary, Schedule};
use crate::models::project::Project as ProjectRecord;
use crate::models::schedule::Schedule as ScheduleRecord;

pub fn project_summary(project: &ProjectRecord) -> ProjectSummary {
    let task_ids: Vec<String> = serde_json::from_str(&project.task_ids).unwrap_or_default();
    ProjectSummary {
        id: project.id.clone(),
        name: project.name.clone(),
        color: project.color.clone(),
        task_count: task_ids.len() as i32,
    }
}

pub fn project_response(project: &ProjectRecord) -> Project {
    Project {
        id: project.id.clone(),
        name: project.name.clone(),
        color: project.color.clone(),
        created_at: project.created_at,
    }
}

pub fn schedule_response(schedule: &ScheduleRecord) -> Schedule {
    Schedule {
        id: schedule.id.clone(),
        prompt: schedule.prompt.clone(),
        frequency: schedule.frequency.clone(),
        cron_expr: schedule.cron_expr.clone(),
        enabled: schedule.enabled,
        last_run_at: schedule.last_run_at,
        next_run_at: schedule.next_run_at,
        created_at: schedule.created_at,
    }
}

pub fn provider_display_name(id: &str) -> &'static str {
    match id {
        "chatgpt" => "ChatGPT",
        "claude" => "Claude",
        "deepseek" => "DeepSeek",
        "kimi" => "Kimi",
        "glm" => "GLM",
        "minimax" => "MiniMax",
        "openrouter" => "OpenRouter",
        "gemini" => "Gemini",
        "nvidia" => "NVIDIA",
        "ollama" => "Ollama",
        _ => "Unknown",
    }
}
