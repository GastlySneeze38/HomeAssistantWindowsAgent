use axum::{extract::{Json, State}, response::IntoResponse, http::StatusCode};
use serde_json::{json, Value};
use std::sync::Arc;
use crate::actions::close::{close_application, CloseRequest};
use crate::core::database::Database;
use crate::actions::launcher::{launch_application, LaunchRequest};
use crate::monitoring::system::{SystemInfo, get_available_ram};
use crate::core::auth::{LoginRequest, LoginResponse};
use crate::core::middleware::BearerToken;

pub async fn health_handler() -> impl IntoResponse {
    "OK"
}

pub async fn setup_status_handler(
    State(db): State<Arc<Database>>,
) -> Json<serde_json::Value> {
    let needs_setup = db.user_exists("admin").unwrap_or(false);
    Json(json!({ "needs_setup": needs_setup }))
}

pub async fn setup_finalize_handler(
    State(db): State<Arc<Database>>,
    BearerToken(token): BearerToken,
) -> impl IntoResponse {
    match db.get_user_id_from_token(&token) {
        Ok(Some(_)) if db.user_exists("admin").unwrap_or(false) => {
            match db.force_delete_user("admin") {
                Ok(_) => (StatusCode::OK, Json(json!({ "success": true }))),
                Err(e) => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "success": false, "error": e.to_string() })),
                ),
            }
        }
        _ => (
            StatusCode::UNAUTHORIZED,
            Json(json!({ "success": false, "error": "Unauthorized or admin not found" })),
        ),
    }
}

pub async fn system_handler(
    State(db): State<Arc<Database>>,
    BearerToken(token): BearerToken,
) -> Result<Json<SystemInfo>, (StatusCode, Json<serde_json::Value>)> {
    match db.verify_token(&token) {
        Ok(true) => {
            let available_ram_gb = get_available_ram();
            Ok(Json(SystemInfo {
                available_ram_gb,
            }))
        }
        _ => Err((
            StatusCode::UNAUTHORIZED,
            Json(json!({
                "error": "Invalid or expired token"
            })),
        )),
    }
}

pub async fn launch_handler(
    State(db): State<Arc<Database>>,
    BearerToken(token): BearerToken,
    payload: Json<LaunchRequest>,
) -> Result<Json<crate::actions::launcher::LaunchResponse>, (StatusCode, Json<serde_json::Value>)> {
    match db.get_user_id_from_token(&token) {
        Ok(Some(user_id)) => {
            let response = launch_application(payload.0.clone());

            let _ = db.add_entry(
                user_id,
                "launch",
                &payload.0.command,
                response.success,
                response.error.clone(),
            );

            Ok(Json(response))
        }
        _ => Err((
            StatusCode::UNAUTHORIZED,
            Json(json!({
                "error": "Invalid or expired token"
            })),
        )),
    }
}

pub async fn close_handler(
    State(db): State<Arc<Database>>,
    BearerToken(token): BearerToken,
    payload: Json<CloseRequest>,
) -> Result<Json<crate::actions::close::CloseResponse>, (StatusCode, Json<serde_json::Value>)> {
    match db.get_user_id_from_token(&token) {
        Ok(Some(user_id)) => {
            let response = close_application(payload.0.clone());
            let _ = db.add_entry(
                user_id,
                "close",
                &payload.0.command,
                response.success,
                response.error.clone(),
            );
            Ok(Json(response))
        }
        _ => Err((
            StatusCode::UNAUTHORIZED,
            Json(json!({
                "error": "Invalid or expired token"
            })),
        )),
    }
}

pub async fn history_handler(
    State(db): State<Arc<Database>>,
    BearerToken(token): BearerToken,
) -> Result<Json<Vec<crate::core::database::HistoryEntry>>, (StatusCode, Json<serde_json::Value>)> {
    match db.get_user_id_from_token(&token) {
        Ok(Some(user_id)) => {
            match db.get_history(user_id, 100) {
                Ok(entries) => Ok(Json(entries)),
                Err(_) => Ok(Json(vec![])),
            }
        }
        _ => Err((
            StatusCode::UNAUTHORIZED,
            Json(json!({
                "error": "Invalid or expired token"
            })),
        )),
    }
}

pub async fn login_handler(
    State(db): State<Arc<Database>>,
    Json(payload): Json<LoginRequest>,
) -> Json<LoginResponse> {
    match db.login(&payload.username, &payload.password) {
        Ok(Some(token)) => Json(LoginResponse {
            success: true,
            token: Some(token),
            message: "Login successful".to_string(),
        }),
        Ok(None) => Json(LoginResponse {
            success: false,
            token: None,
            message: "Invalid credentials".to_string(),
        }),
        Err(_) => Json(LoginResponse {
            success: false,
            token: None,
            message: "Internal server error".to_string(),
        }),
    }
}

pub async fn logout_handler(
    State(db): State<Arc<Database>>,
    bearer: BearerToken,
) -> StatusCode {
    match db.delete_token(&bearer.0) {
        Ok(_) => StatusCode::OK,
        Err(_) => StatusCode::INTERNAL_SERVER_ERROR,
    }
}

pub async fn handle_create_user(
    State(db): State<Arc<Database>>,
    BearerToken(token): BearerToken,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, (StatusCode, Json<Value>)> {
    match db.verify_token(&token) {
        Ok(true) => {
            match db.create_user(&payload.username, &payload.password) {
                Ok(_) => Ok(Json(LoginResponse {
                    success: true,
                    token: None,
                    message: "User created successfully".to_string(),
                })),
                Err(_) => Err((
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({
                        "error": "Internal server error"
                    })),
                )),
            }
        }
        _ => Err((
            StatusCode::UNAUTHORIZED,
            Json(json!({
                "error": "Invalid or expired token"
            })),
        )),
    }
}

pub async fn handle_delete_user(
    State(db): State<Arc<Database>>,
    BearerToken(token): BearerToken,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, (StatusCode, Json<Value>)> {
    match db.verify_token(&token) {
        Ok(true) => {
            match db.delete_user(&payload.username, &payload.password) {
                Ok(true) => Ok(Json(LoginResponse {
                    success: true,
                    token: None,
                    message: "User deleted successfully".to_string(),
                })),
                Ok(false) => Ok(Json(LoginResponse {
                    success: false,
                    token: None,
                    message: "Invalid credentials".to_string(),
                })),
                Err(_) => Err((
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({
                        "error": "Internal server error"
                    })),
                )),
            }
        }
        _ => Err((
            StatusCode::UNAUTHORIZED,
            Json(json!({
                "error": "Invalid or expired token"
            })),
        )),
    }
}
