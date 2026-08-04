use axum::routing::get;
use axum::Json;

pub async fn get_runtime_stats() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "app": {
            "cpuPercent": 0.0,
            "memoryMB": 0.0,
        },
        "system": {
            "freeMemMB": 0.0,
        },
    }))
}

pub fn routes() -> axum::Router<crate::api::state::AppState> {
    axum::Router::new().route("/runtime/stats", get(get_runtime_stats))
}
