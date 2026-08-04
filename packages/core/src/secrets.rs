use std::collections::{HashMap, HashSet};

use crate::db::{get_conn, DbPool};
use crate::error::AppError;
use crate::repo;

const PROVIDER_IDS: &[&str] = &[
    "chatgpt",
    "claude",
    "deepseek",
    "kimi",
    "glm",
    "minimax",
    "openrouter",
    "gemini",
    "nvidia",
    "ollama",
];

pub struct SecretsStore {
    pool: DbPool,
}

impl SecretsStore {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    pub fn get(&self, provider: &str) -> Option<String> {
        let mut conn = get_conn(&self.pool).ok()?;
        repo::credentials::get(&mut conn, provider)
            .ok()
            .flatten()
            .filter(|k| !k.is_empty())
    }

    pub fn set(&self, provider: &str, api_key: &str) -> Result<(), AppError> {
        if !PROVIDER_IDS.contains(&provider) {
            return Err(AppError::BadRequest(format!("unknown provider: {provider}")));
        }
        let trimmed = api_key.trim();
        if trimmed.is_empty() {
            return Err(AppError::BadRequest("apiKey cannot be empty".into()));
        }
        let mut conn = get_conn(&self.pool)?;
        repo::credentials::upsert(&mut conn, provider, trimmed)
    }

    pub fn delete(&self, provider: &str) -> Result<(), AppError> {
        let mut conn = get_conn(&self.pool)?;
        repo::credentials::delete(&mut conn, provider)
    }

    pub fn has(&self, provider: &str) -> bool {
        self.get(provider).is_some()
    }

    pub fn status_map(&self) -> HashMap<String, bool> {
        let configured = match get_conn(&self.pool).and_then(|mut conn| repo::credentials::list(&mut conn)) {
            Ok(rows) => rows
                .into_iter()
                .map(|row| row.provider_id)
                .collect::<HashSet<_>>(),
            Err(_) => HashSet::new(),
        };

        PROVIDER_IDS
            .iter()
            .map(|id| (id.to_string(), configured.contains(*id)))
            .collect()
    }
}
