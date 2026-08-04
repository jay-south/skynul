use std::path::{Path, PathBuf};

fn home_dir() -> Option<PathBuf> {
    std::env::var("HOME").ok().map(PathBuf::from)
}

pub fn tool_base_dir() -> PathBuf {
    if let Ok(dir) = std::env::var("SKYNUL_HOME") {
        if !dir.is_empty() {
            return PathBuf::from(dir);
        }
    }
    home_dir().unwrap_or_else(|| {
        std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
    })
}

pub fn documents_dir() -> PathBuf {
    if let Ok(dir) = std::env::var("XDG_DOCUMENTS_DIR") {
        if !dir.is_empty() {
            return PathBuf::from(dir);
        }
    }
    tool_base_dir().join("Documents")
}

pub fn resolve_path(path: &str) -> PathBuf {
    let trimmed = path.trim();
    if trimmed.is_empty() || trimmed == "." {
        return tool_base_dir();
    }

    let expanded = if trimmed == "~" {
        tool_base_dir()
    } else if let Some(rest) = trimmed.strip_prefix("~/") {
        tool_base_dir().join(rest)
    } else if trimmed == "$HOME" {
        tool_base_dir()
    } else if let Some(rest) = trimmed.strip_prefix("$HOME/") {
        tool_base_dir().join(rest)
    } else {
        PathBuf::from(trimmed)
    };

    if expanded.is_absolute() {
        return expanded;
    }

    tool_base_dir().join(expanded)
}

struct TruncationResult {
    content: String,
    truncated: bool,
    total_lines: usize,
    output_lines: usize,
    total_bytes: usize,
    output_bytes: usize,
}

fn truncate_head(text: &str, max_lines: usize, max_bytes: usize) -> TruncationResult {
    let total_bytes = text.len();
    let lines: Vec<&str> = if text.is_empty() {
        Vec::new()
    } else {
        text.split('\n').collect()
    };
    let total_lines = if text.ends_with('\n') && !text.is_empty() {
        lines.len().saturating_sub(1)
    } else {
        lines.len()
    };

    if total_lines <= max_lines && total_bytes <= max_bytes {
        return TruncationResult {
            content: text.to_string(),
            truncated: false,
            total_lines,
            output_lines: total_lines,
            total_bytes,
            output_bytes: total_bytes,
        };
    }

    let mut output_lines_arr: Vec<&str> = Vec::new();
    let mut output_bytes = 0usize;
    for (index, line) in lines.iter().enumerate().take(max_lines) {
        let line_bytes = line.len() + if index > 0 { 1 } else { 0 };
        if output_bytes + line_bytes > max_bytes {
            break;
        }
        output_lines_arr.push(line);
        output_bytes += line_bytes;
    }

    let content = output_lines_arr.join("\n");
    let output_bytes = content.len();
    TruncationResult {
        content,
        truncated: true,
        total_lines,
        output_lines: output_lines_arr.len(),
        total_bytes,
        output_bytes,
    }
}

fn format_truncated(result: TruncationResult) -> String {
    if !result.truncated {
        return result.content;
    }
    let remaining_lines = result.total_lines.saturating_sub(result.output_lines);
    let mut notices = Vec::new();
    if remaining_lines > 0 {
        notices.push(format!("{remaining_lines} more lines"));
    }
    if result.total_bytes > result.output_bytes {
        notices.push(format!(
            "{} bytes omitted",
            result.total_bytes.saturating_sub(result.output_bytes)
        ));
    }
    if notices.is_empty() {
        return result.content;
    }
    format!(
        "{}\n\n[Truncated: showing {} of {} lines. {}]",
        result.content,
        result.output_lines,
        result.total_lines,
        notices.join(", ")
    )
}

pub async fn bash(command: &str, cwd: Option<&str>) -> Result<String, String> {
    run_shell(command, cwd, 120_000)
        .await
        .map(|out| format_truncated(truncate_tail(&out, 2000, 50 * 1024)))
}

fn truncate_tail(text: &str, max_lines: usize, max_bytes: usize) -> TruncationResult {
    let total_bytes = text.len();
    let lines: Vec<&str> = if text.is_empty() {
        Vec::new()
    } else {
        text.split('\n').collect()
    };
    let total_lines = if text.ends_with('\n') && !text.is_empty() {
        lines.len().saturating_sub(1)
    } else {
        lines.len()
    };

    if total_lines <= max_lines && total_bytes <= max_bytes {
        return TruncationResult {
            content: text.to_string(),
            truncated: false,
            total_lines,
            output_lines: total_lines,
            total_bytes,
            output_bytes: total_bytes,
        };
    }

    let mut output_lines_arr: Vec<&str> = Vec::new();
    let mut output_bytes = 0usize;
    for (index, line) in lines.iter().rev().take(max_lines).enumerate() {
        let line_bytes = line.len() + if index > 0 { 1 } else { 0 };
        if output_bytes + line_bytes > max_bytes {
            break;
        }
        output_lines_arr.push(line);
        output_bytes += line_bytes;
    }
    output_lines_arr.reverse();

    let content = output_lines_arr.join("\n");
    let output_bytes = content.len();
    TruncationResult {
        content,
        truncated: true,
        total_lines,
        output_lines: output_lines_arr.len(),
        total_bytes,
        output_bytes,
    }
}

pub async fn read_file(path: &str, offset: Option<i64>, limit: Option<i64>) -> Result<String, String> {
    let file_path = resolve_path(path);
    let content = tokio::fs::read_to_string(&file_path)
        .await
        .map_err(|e| format!("[Error reading {}: {e}]", file_path.display()))?;

    let mut lines: Vec<&str> = content.lines().collect();
    let start = offset.map(|o| o.saturating_sub(1) as usize).unwrap_or(0);
    if let Some(lim) = limit {
        lines = lines.into_iter().skip(start).take(lim as usize).collect();
    } else if start > 0 {
        lines = lines.into_iter().skip(start).collect();
    }

    let numbered = lines
        .iter()
        .enumerate()
        .map(|(i, line)| format!("{:>6}\t{line}", start + i + 1))
        .collect::<Vec<_>>()
        .join("\n");

    Ok(format_truncated(truncate_head(&numbered, 2000, 8000)))
}

#[derive(Debug, Clone)]
pub struct EditPatch {
    pub old_text: String,
    pub new_text: String,
}

pub fn apply_edits(content: &str, edits: &[EditPatch], path: &str) -> Result<String, String> {
    if edits.is_empty() {
        return Err("[Error: edits must contain at least one replacement]".into());
    }

    let mut regions: Vec<(usize, usize, &str)> = Vec::new();
    for edit in edits {
        if edit.old_text.is_empty() {
            return Err("[Error: oldText cannot be empty]".into());
        }
        let count = content.matches(&edit.old_text).count();
        if count == 0 {
            return Err(format!(
                "[Error: oldText not found in {path}. Include enough surrounding context to make it unique.]"
            ));
        }
        if count > 1 {
            return Err(format!(
                "[Error: oldText is not unique in {path} ({count} matches). Include more context.]"
            ));
        }
        let start = content.find(&edit.old_text).unwrap_or(0);
        regions.push((start, start + edit.old_text.len(), edit.new_text.as_str()));
    }

    regions.sort_by_key(|region| region.0);
    for index in 1..regions.len() {
        if regions[index].0 < regions[index - 1].1 {
            return Err("[Error: edits overlap — merge nearby changes into one edit]".into());
        }
    }

    let mut out = String::new();
    let mut last = 0usize;
    for (start, end, new_text) in regions {
        out.push_str(&content[last..start]);
        out.push_str(new_text);
        last = end;
    }
    out.push_str(&content[last..]);
    Ok(out)
}

pub async fn edit_file(path: &str, edits: &[EditPatch]) -> Result<String, String> {
    let file_path = resolve_path(path);
    let content = tokio::fs::read_to_string(&file_path)
        .await
        .map_err(|e| format!("[Error reading {}: {e}]", file_path.display()))?;

    let updated = apply_edits(&content, edits, path)?;
    tokio::fs::write(&file_path, &updated)
        .await
        .map_err(|e| format!("[Error writing {}: {e}]", file_path.display()))?;

    Ok(format!(
        "Successfully replaced {} block(s) in {} ({} → {} bytes).",
        edits.len(),
        file_path.display(),
        content.len(),
        updated.len()
    ))
}

pub async fn write_file(path: &str, content: &str) -> Result<String, String> {
    let file_path = resolve_path(path);
    if let Some(parent) = file_path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("[Error creating dirs: {e}]"))?;
    }
    tokio::fs::write(&file_path, content)
        .await
        .map_err(|e| format!("[Error writing {}: {e}]", file_path.display()))?;
    Ok(format!(
        "File written: {} ({} bytes)",
        file_path.display(),
        content.len()
    ))
}

pub async fn ls(path: &str) -> Result<String, String> {
    let dir = resolve_path(path);
    if !dir.is_dir() {
        return Err(format!("[Error: not a directory: {}]", dir.display()));
    }

    let mut entries = tokio::fs::read_dir(&dir)
        .await
        .map_err(|e| format!("[Error listing {}: {e}]", dir.display()))?;

    let mut lines = Vec::new();
    while let Some(entry) = entries
        .next_entry()
        .await
        .map_err(|e| format!("[Error listing {}: {e}]", dir.display()))?
    {
        let name = entry.file_name().to_string_lossy().into_owned();
        let kind = entry
            .file_type()
            .await
            .map(|t| {
                if t.is_dir() {
                    "dir"
                } else if t.is_symlink() {
                    "link"
                } else {
                    "file"
                }
            })
            .unwrap_or("?");
        lines.push(format!("{kind}\t{name}"));
    }

    lines.sort();
    let header = format!("{} ({} entries)", dir.display(), lines.len());
    let body = if lines.is_empty() {
        "(empty directory)".to_string()
    } else {
        lines.join("\n")
    };

    Ok(format_truncated(truncate_head(&format!("{header}\n{body}"), 2000, 8000)))
}

const DEFAULT_FIND_LIMIT: usize = 1000;

fn normalize_find_pattern(pattern: &str) -> String {
    let pattern = pattern.trim();
    if pattern.is_empty() || pattern == "**" {
        return "**/*".to_string();
    }
    if pattern.starts_with('/') {
        return pattern.trim_start_matches('/').to_string();
    }
    if pattern.starts_with("**/") || pattern.contains('/') {
        return pattern.to_string();
    }
    pattern.to_string()
}

pub fn find_files(base: &Path, pattern: &str, limit: usize) -> Result<Vec<String>, String> {
    use globset::{GlobBuilder, GlobSetBuilder};
    use ignore::WalkBuilder;

    let effective_pattern = normalize_find_pattern(pattern);
    let glob = GlobBuilder::new(&effective_pattern)
        .literal_separator(false)
        .build()
        .map_err(|e| format!("[Error: invalid pattern '{pattern}': {e}]"))?;
    let set = GlobSetBuilder::new()
        .add(glob)
        .build()
        .map_err(|e| format!("[Error: invalid pattern '{pattern}': {e}]"))?;

    let mut walker = WalkBuilder::new(base);
    walker.hidden(true);
    walker.git_ignore(true);
    walker.git_global(true);
    walker.git_exclude(true);

    let mut out = Vec::new();
    for entry in walker.build().flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let rel = path.strip_prefix(base).unwrap_or(path);
        if !set.is_match(rel) && !set.is_match(path) {
            continue;
        }
        out.push(rel.display().to_string().replace('\\', "/"));
        if out.len() >= limit {
            break;
        }
    }

    Ok(out)
}

pub async fn find(pattern: &str, path: &str, limit: Option<i64>) -> Result<String, String> {
    let base = resolve_path(path);
    if !base.is_dir() {
        return Err(format!("[Error: not a directory: {}]", base.display()));
    }

    let effective_limit = limit
        .map(|value| value.max(1) as usize)
        .unwrap_or(DEFAULT_FIND_LIMIT);
    let effective_pattern = normalize_find_pattern(pattern);
    let matches = find_files(&base, pattern, effective_limit)?;
    let hit_limit = matches.len() >= effective_limit;
    let mut body = if matches.is_empty() {
        format!(
            "No files found matching '{pattern}' (glob: {effective_pattern}) in {}",
            base.display()
        )
    } else {
        format!("{}\n{}", base.display(), matches.join("\n"))
    };

    if hit_limit {
        body.push_str(&format!(
            "\n\n[{effective_limit} results limit reached. Use a higher limit or refine the pattern.]"
        ));
    }

    Ok(format_truncated(truncate_head(&body, 2000, 50 * 1024)))
}

pub async fn fetch_url(url: &str) -> Result<String, String> {
    use std::time::Duration;

    let url = url.trim();
    if url.is_empty() {
        return Err("[Error: url is required]".into());
    }
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err("[Error: url must start with http:// or https://]".into());
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .redirect(reqwest::redirect::Policy::limited(5))
        .build()
        .map_err(|e| format!("[Error: http client: {e}]"))?;

    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("[Error fetching {url}: {e}]"))?;

    let status = response.status();
    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|value| value.to_str().ok())
        .unwrap_or("unknown")
        .to_string();

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("[Error reading response body: {e}]"))?;

    let body = if content_type.contains("text")
        || content_type.contains("json")
        || content_type.contains("xml")
        || content_type.contains("html")
    {
        String::from_utf8_lossy(&bytes).into_owned()
    } else {
        format!(
            "[Binary content: {} bytes, content-type: {content_type}]",
            bytes.len()
        )
    };

    let output = format!("HTTP {status}\nContent-Type: {content_type}\n\n{body}");
    Ok(format_truncated(truncate_head(&output, 2000, 50 * 1024)))
}

pub async fn grep(pattern: &str, path: &str) -> Result<String, String> {
    use tokio::process::Command;
    use tokio::time::{timeout, Duration};

    const MAX_MATCHES: &str = "50";
    const MAX_DEPTH: &str = "8";
    const TIMEOUT_MS: u64 = 30_000;

    let target = resolve_path(path);
    if !target.exists() {
        return Err(format!("[Error: path not found: {}]", target.display()));
    }

    let mut command = Command::new("rg");
    command.args([
        "-n",
        "--color=never",
        "--no-messages",
        "--max-count",
        MAX_MATCHES,
        "--glob",
        "!.git/**",
    ]);

    if target.is_dir() {
        command.args(["--max-depth", MAX_DEPTH, "--hidden"]);
        command.current_dir(&target);
        command.arg(pattern);
        command.arg(".");
    } else {
        command.arg(pattern);
        command.arg(&target);
    }

    command.stdout(std::process::Stdio::piped());
    command.stderr(std::process::Stdio::piped());

    let child = command
        .spawn()
        .map_err(|e| format!("[Error: rg not available: {e}. Install ripgrep (rg).]"))?;

    let output = timeout(Duration::from_millis(TIMEOUT_MS), child.wait_with_output())
        .await
        .map_err(|_| "[Error: grep timed out — narrow the path to a specific directory]".to_string())?
        .map_err(|e| format!("[Error running rg: {e}]"))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let code = output.status.code().unwrap_or(-1);

    if code == 1 || (code == 0 && stdout.trim().is_empty()) {
        let scope = target.display();
        return Ok(format_truncated(truncate_head(
            &format!("(no matches found in {scope})"),
            2000,
            50 * 1024,
        )));
    }

    if code != 0 {
        let message = if !stderr.trim().is_empty() {
            stderr.trim().to_string()
        } else {
            format!("rg exited with code {code}")
        };
        return Err(format!("[Error searching {}: {message}]", target.display()));
    }

    let header = format!("{} (content search)", target.display());
    let body = format!("{header}\n{}", stdout.trim());
    Ok(format_truncated(truncate_head(&body, 2000, 50 * 1024)))
}

async fn run_shell(cmd: &str, cwd: Option<&str>, timeout_ms: u64) -> Result<String, String> {
    use tokio::process::Command;
    use tokio::time::{timeout, Duration};

    let mut command = if cfg!(windows) {
        let mut c = Command::new("cmd");
        c.args(["/C", cmd]);
        c
    } else {
        let mut c = Command::new("sh");
        c.args(["-c", cmd]);
        c
    };

    if let Some(cwd) = cwd {
        let dir = resolve_path(cwd);
        if !dir.is_dir() {
            return Err(format!("[Error: not a directory: {}]", dir.display()));
        }
        command.current_dir(dir);
    }

    command.stdout(std::process::Stdio::piped());
    command.stderr(std::process::Stdio::piped());

    let child = command
        .spawn()
        .map_err(|e| format!("[Error spawning command: {e}]"))?;

    let output = timeout(Duration::from_millis(timeout_ms), child.wait_with_output())
        .await
        .map_err(|_| "[Error: command timed out]".to_string())?
        .map_err(|e| format!("[Error running command: {e}]"))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    if !stderr.trim().is_empty() && stdout.trim().is_empty() {
        Ok(stderr.to_string())
    } else if !stderr.trim().is_empty() {
        Ok(format!("{stdout}{stderr}"))
    } else {
        Ok(stdout.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn apply_edits_single_replacement() {
        let content = "fn main() {\n    println!(\"hi\");\n}\n";
        let edits = vec![EditPatch {
            old_text: "println!(\"hi\");".into(),
            new_text: "println!(\"hello\");".into(),
        }];
        let out = apply_edits(content, &edits, "main.rs").unwrap();
        assert!(out.contains("hello"));
        assert!(!out.contains("\"hi\""));
    }

    #[test]
    fn apply_edits_rejects_non_unique() {
        let content = "aaa bbb aaa";
        let edits = vec![EditPatch {
            old_text: "aaa".into(),
            new_text: "ccc".into(),
        }];
        assert!(apply_edits(content, &edits, "x.txt").is_err());
    }

    #[test]
    fn apply_edits_rejects_overlap() {
        let content = "abcdef";
        let edits = vec![
            EditPatch {
                old_text: "abc".into(),
                new_text: "xxx".into(),
            },
            EditPatch {
                old_text: "bcd".into(),
                new_text: "yyy".into(),
            },
        ];
        assert!(apply_edits(content, &edits, "x.txt").is_err());
    }

    #[test]
    fn normalize_find_pattern_adds_glob_prefix() {
        assert_eq!(normalize_find_pattern("*.pdf"), "*.pdf");
        assert_eq!(normalize_find_pattern("src/**/*.rs"), "src/**/*.rs");
    }

    #[test]
    fn find_files_matches_pdf_in_directory() {
        let dir = std::env::temp_dir().join(format!("skynul-find-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("a.pdf"), b"x").unwrap();
        std::fs::write(dir.join("b.txt"), b"x").unwrap();

        let matches = find_files(&dir, "*.pdf", 10).unwrap();
        assert!(matches.iter().any(|m| m.ends_with("a.pdf")));
        assert!(!matches.iter().any(|m| m.ends_with("b.txt")));

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn truncate_head_reports_remaining_lines() {
        let text = (0..30).map(|i| format!("line {i}")).collect::<Vec<_>>().join("\n");
        let out = format_truncated(truncate_head(&text, 20, 50 * 1024));
        assert!(out.contains("showing 20 of 30 lines"));
        assert!(out.contains("10 more lines"));
    }
}
