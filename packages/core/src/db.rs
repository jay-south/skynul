use std::path::PathBuf;

use crate::error::AppError;
use diesel::prelude::*;
use diesel::r2d2::{self, ConnectionManager, CustomizeConnection};
use diesel::sql_query;
use diesel::RunQueryDsl;
use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness};

pub type DbPool = r2d2::Pool<ConnectionManager<SqliteConnection>>;
pub type DbConn = r2d2::PooledConnection<ConnectionManager<SqliteConnection>>;

const MIGRATIONS: EmbeddedMigrations = embed_migrations!("./migrations");

#[derive(Debug)]
struct SqliteConnectionOptions;

impl CustomizeConnection<SqliteConnection, r2d2::Error> for SqliteConnectionOptions {
    fn on_acquire(&self, conn: &mut SqliteConnection) -> Result<(), r2d2::Error> {
        sql_query("PRAGMA journal_mode=WAL")
            .execute(conn)
            .map_err(r2d2::Error::QueryError)?;
        sql_query("PRAGMA busy_timeout=5000")
            .execute(conn)
            .map_err(r2d2::Error::QueryError)?;
        sql_query("PRAGMA synchronous=NORMAL")
            .execute(conn)
            .map_err(r2d2::Error::QueryError)?;
        Ok(())
    }
}

pub fn default_db_path() -> PathBuf {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join(".skynul").join("skynul.db")
}

pub fn resolve_db_path() -> PathBuf {
    std::env::var("SKYNUL_DB_PATH")
        .map(PathBuf::from)
        .unwrap_or_else(|_| default_db_path())
}

pub fn establish_pool(db_path: Option<&str>) -> Result<DbPool, AppError> {
    let path = db_path
        .map(PathBuf::from)
        .unwrap_or_else(default_db_path);

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(AppError::from)?;
    }

    let url = format!("file:{}?mode=rwc", path.display());
    let manager = ConnectionManager::<SqliteConnection>::new(&url);
    let pool = DbPool::builder()
        .max_size(10)
        .connection_customizer(Box::new(SqliteConnectionOptions))
        .build(manager)
        .map_err(|e| AppError::Internal(format!("failed to build connection pool: {e}")))?;

    run_migrations(&pool)?;

    tracing::info!("database: {}", path.display());

    Ok(pool)
}

pub fn run_migrations(pool: &DbPool) -> Result<(), AppError> {
    let mut conn = pool
        .get()
        .map_err(|e| AppError::Internal(format!("failed to get connection: {e}")))?;
    conn.run_pending_migrations(MIGRATIONS)
        .map_err(|e| AppError::Internal(format!("migration failed: {e}")))?;
    Ok(())
}

pub fn get_conn(pool: &DbPool) -> Result<DbConn, AppError> {
    pool.get()
        .map_err(|e| AppError::Internal(format!("failed to acquire connection: {e}")))
}
