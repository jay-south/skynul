use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use diesel::result::Error as DieselError;
use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("not found: {0}")]
    NotFound(String),

    #[error("bad request: {0}")]
    BadRequest(String),

    #[error("internal error: {0}")]
    Internal(String),

    #[error("database error: {0}")]
    Database(#[from] DieselError),

    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
}

#[derive(Serialize)]
struct ErrorDetail {
    code: String,
    message: String,
}

#[derive(Serialize)]
struct ErrorBody {
    error: ErrorDetail,
}

impl AppError {
    fn code(&self) -> &'static str {
        match self {
            AppError::NotFound(_) => "not_found",
            AppError::BadRequest(_) => "bad_request",
            AppError::Internal(_) => "internal_error",
            AppError::Database(_) => "database_error",
            AppError::Io(_) => "io_error",
        }
    }

    fn client_message(&self) -> String {
        match self {
            AppError::NotFound(msg) => msg.clone(),
            AppError::BadRequest(msg) => msg.clone(),
            AppError::Internal(msg) => msg.clone(),
            AppError::Database(_) => "internal server error".to_string(),
            AppError::Io(err) => err.to_string(),
        }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let status = match &self {
            AppError::NotFound(msg) => {
                tracing::warn!("not found: {msg}");
                StatusCode::NOT_FOUND
            }
            AppError::BadRequest(msg) => {
                tracing::warn!("bad request: {msg}");
                StatusCode::BAD_REQUEST
            }
            AppError::Internal(msg) => {
                tracing::error!("internal error: {msg}");
                StatusCode::INTERNAL_SERVER_ERROR
            }
            AppError::Database(err) => {
                tracing::error!("database error: {err}");
                StatusCode::INTERNAL_SERVER_ERROR
            }
            AppError::Io(err) => {
                tracing::error!("io error: {err}");
                StatusCode::INTERNAL_SERVER_ERROR
            }
        };

        let body = ErrorBody {
            error: ErrorDetail {
                code: self.code().to_string(),
                message: self.client_message(),
            },
        };
        (status, axum::Json(body)).into_response()
    }
}
