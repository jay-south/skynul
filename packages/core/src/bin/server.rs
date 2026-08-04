use std::sync::Arc;

use skynul_core::api::{router, AppState, TaskStreamHub, ToolApprovalHub};
use skynul_core::channels::spawn_runtime;
use skynul_core::db::establish_pool;
use skynul_core::secrets::SecretsStore;
use tower_http::cors::{Any, CorsLayer};

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_target(false)
        .with_level(true)
        .init();

    let db_path = std::env::var("SKYNUL_DB_PATH").ok();
    let pool = establish_pool(db_path.as_deref()).expect("failed to init database");
    let secrets = Arc::new(SecretsStore::new(pool.clone()));
    let task_streams = TaskStreamHub::new();
    let tool_approvals = ToolApprovalHub::new();
    let channels = spawn_runtime(
        pool.clone(),
        secrets.clone(),
        task_streams.clone(),
        tool_approvals.clone(),
    )
    .await;

    let state = AppState {
        pool,
        channels,
        secrets,
        task_streams,
        tool_approvals,
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = router(state).layer(cors);

    let port = std::env::var("SKYNUL_PORT").unwrap_or_else(|_| "3141".to_string());
    let addr = format!("0.0.0.0:{port}");
    tracing::info!("skynul-server listening on http://{addr}");

    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .expect("failed to bind address");
    axum::serve(listener, app).await.expect("server failed");
}
