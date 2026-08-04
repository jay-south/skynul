use std::path::{Path, PathBuf};

#[derive(Debug, Clone)]
pub struct SkillEntry {
    pub name: String,
    pub description: String,
    pub path: PathBuf,
}

pub fn discover_skills(base: &Path) -> Vec<SkillEntry> {
    let skills_root = base.join(".agents/skills");
    let mut out = Vec::new();
    collect_skills(&skills_root, &mut out);
    out.sort_by(|a, b| a.name.cmp(&b.name));
    out
}

fn collect_skills(root: &Path, out: &mut Vec<SkillEntry>) {
    let entries = match std::fs::read_dir(root) {
        Ok(entries) => entries,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let skill_file = path.join("SKILL.md");
        if !skill_file.is_file() {
            continue;
        }
        let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        let raw = std::fs::read_to_string(&skill_file).unwrap_or_default();
        let description = parse_skill_description(&raw).unwrap_or_else(|| {
            format!("Skill at .agents/skills/{name}/SKILL.md")
        });
        out.push(SkillEntry {
            name: name.to_string(),
            description,
            path: skill_file,
        });
    }
}

fn parse_skill_description(raw: &str) -> Option<String> {
    let trimmed = raw.trim_start();
    if !trimmed.starts_with("---") {
        return None;
    }
    let rest = trimmed.strip_prefix("---")?;
    let end = rest.find("\n---")?;
    let frontmatter = &rest[..end];
    for line in frontmatter.lines() {
        if let Some(value) = line.strip_prefix("description:") {
            let value = value.trim();
            if value.starts_with('>') {
                return Some(value.trim_start_matches('>').trim().to_string());
            }
            return Some(value.trim_matches('"').trim().to_string());
        }
    }
    None
}

pub fn format_skills_block(skills: &[SkillEntry]) -> String {
    if skills.is_empty() {
        return String::new();
    }
    let mut lines = vec![
        "## Available skills".to_string(),
        "Use `read` on the skill path when a task matches a skill description.".to_string(),
        String::new(),
    ];
    for skill in skills {
        lines.push(format!(
            "- **{}** — {} (read `.agents/skills/{}/SKILL.md`)",
            skill.name, skill.description, skill.name
        ));
    }
    lines.join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_yaml_description() {
        let raw = "---\nname: test\ndescription: Do the thing\n---\n# Body\n";
        assert_eq!(
            parse_skill_description(raw).as_deref(),
            Some("Do the thing")
        );
    }
}
