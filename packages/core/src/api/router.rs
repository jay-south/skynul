use axum::routing::get;
use axum::{response::IntoResponse, Router};

use crate::api::routes;
use crate::api::state::AppState;

async fn ping() -> impl IntoResponse {
    "ok"
}

pub fn router(state: AppState) -> Router {
    let v1 = Router::new()
        .merge(routes::tasks::routes())
        .merge(routes::schedules::routes())
        .merge(routes::projects::routes())
        .merge(routes::runtime::routes())
        .merge(routes::settings::routes())
        .merge(routes::providers::routes())
        .merge(routes::channels::routes())
        .with_state(state);

    Router::new()
        .route("/ping", get(ping))
        .nest("/api/v1", v1)
}
