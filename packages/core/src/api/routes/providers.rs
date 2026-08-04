use axum::extract::{Path, State};
use axum::routing::{get, put};
use axum::{Json, Router};
use serde::Deserialize;

use crate::api::dto::provider_display_name;
use crate::api::routes::settings::ProviderSummaryResponse;
use crate::api::state::AppState;
use crate::api::types::ProviderListItem;
use crate::error::AppError;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PutProviderCredentialsBody {
    api_key: String,
}

async fn list_providers(
    State(state): State<AppState>,
) -> Result<Json<Vec<ProviderListItem>>, AppError> {
    let status = state.secrets.status_map();
    let mut items: Vec<ProviderListItem> = status
        .into_iter()
        .map(|(id, configured)| ProviderListItem {
            name: provider_display_name(&id).to_string(),
            id,
            configured,
        })
        .collect();
    items.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(Json(items))
}

async fn put_provider_credentials(
    State(state): State<AppState>,
    Path(provider_id): Path<String>,
    Json(body): Json<PutProviderCredentialsBody>,
) -> Result<Json<ProviderSummaryResponse>, AppError> {
    state.secrets.set(&provider_id, &body.api_key)?;
    Ok(Json(ProviderSummaryResponse {
        id: provider_id,
        configured: true,
    }))
}

async fn delete_provider_credentials(
    State(state): State<AppState>,
    Path(provider_id): Path<String>,
) -> Result<Json<ProviderSummaryResponse>, AppError> {
    state.secrets.delete(&provider_id)?;
    Ok(Json(ProviderSummaryResponse {
        id: provider_id,
        configured: false,
    }))
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/providers", get(list_providers))
        .route(
            "/providers/{id}/credentials",
            put(put_provider_credentials).delete(delete_provider_credentials),
        )
}
