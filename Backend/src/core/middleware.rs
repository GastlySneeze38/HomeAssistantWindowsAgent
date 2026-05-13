use axum::{
    extract::FromRequestParts,
    http::request::Parts,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use async_trait::async_trait;

#[derive(Debug, Clone)]
pub struct BearerToken(pub String);

#[async_trait]
impl<S> FromRequestParts<S> for BearerToken
where
    S: Send + Sync,
{
    type Rejection = Response;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let header = parts
            .headers
            .get("Authorization")
            .and_then(|v| v.to_str().ok());

        if let Some(header) = header {
            if let Some(token) = header.strip_prefix("Bearer ") {
                return Ok(BearerToken(token.to_string()));
            }
        }

        Err((
            axum::http::StatusCode::UNAUTHORIZED,
            Json(json!({
                "error": "Missing or invalid Authorization header",
                "message": "Please provide a valid Bearer token"
            })),
        )
            .into_response())
    }
}
