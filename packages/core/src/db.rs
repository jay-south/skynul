use crate::error::AppError;
use diesel::prelude::*;
use diesel::r2d2::{self, ConnectionManager};
use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness};

pub type DbPool = r2d2::Pool<ConnectionManager<SqliteConnection>>;
pub type DbConn = r2d2::PooledConnection<ConnectionManager<SqliteConnection>>;

const MIGRATIONS: EmbeddedMigrations = embed_migrations!("./migrations");

pub fn establish_pool(db_path: Option<&str>) -> Result<DbPool, AppError> {
    let url = db_path
        .map(|p| format!("file:{p}?mode=rwc"))
        .unwrap_or_else(|| ":memory:".to_string());

    let manager = ConnectionManager::<SqliteConnection>::new(&url);
    let pool = DbPool::builder()
        .max_size(1)
        .build(manager)
        .map_err(|e| AppError::Internal(format!("failed to build connection pool: {e}")))?;

    run_migrations(&pool)?;

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
