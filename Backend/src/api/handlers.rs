use axum::{extract::{Json, State}, response::IntoResponse, http::StatusCode};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;
use crate::actions::close::{close_application, CloseRequest};
use crate::core::database::{Database, AppEntry};
use crate::actions::launcher::{launch_application, LaunchRequest};
use crate::core::auth::{LoginRequest, LoginResponse};
use crate::core::middleware::BearerToken;
use crate::actions::rgb;

#[derive(Deserialize)]
pub struct AppRequest {
    pub name: String,
    pub path: String,
    pub args: Option<String>,
}

#[derive(Deserialize)]
pub struct AppDeleteRequest {
    pub name: String,
}

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

pub async fn launch_handler(
    State(db): State<Arc<Database>>,
    BearerToken(token): BearerToken,
    payload: Json<LaunchRequest>,
) -> Result<Json<crate::actions::launcher::LaunchResponse>, (StatusCode, Json<serde_json::Value>)> {
    match db.get_user_id_from_token(&token) {
        Ok(Some(user_id)) => {
            let response = launch_application(payload.0.clone(), &db);

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
            let response = close_application(payload.0.clone(), &db);
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

pub async fn get_apps_handler(
    State(db): State<Arc<Database>>,
    BearerToken(token): BearerToken,
) -> Result<Json<Vec<AppEntry>>, (StatusCode, Json<Value>)> {
    match db.verify_token(&token) {
        Ok(true) => match db.get_apps() {
            Ok(apps) => Ok(Json(apps)),
            Err(e) => Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )),
        },
        _ => Err((StatusCode::UNAUTHORIZED, Json(json!({ "error": "Invalid or expired token" })))),
    }
}

pub async fn add_app_handler(
    State(db): State<Arc<Database>>,
    BearerToken(token): BearerToken,
    Json(payload): Json<AppRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    match db.verify_token(&token) {
        Ok(true) => match db.add_app(&payload.name, &payload.path, payload.args.as_deref()) {
            Ok(_) => Ok(Json(json!({ "success": true }))),
            Err(e) => Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )),
        },
        _ => Err((StatusCode::UNAUTHORIZED, Json(json!({ "error": "Invalid or expired token" })))),
    }
}

#[derive(Deserialize)]
pub struct RgbColorRequest {
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub device_id: Option<u32>,
}

#[derive(Deserialize)]
pub struct RgbOffRequest {
    pub device_id: Option<u32>,
}

pub async fn rgb_devices_handler(
    State(db): State<Arc<Database>>,
    BearerToken(token): BearerToken,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    match db.verify_token(&token) {
        Ok(true) => match rgb::get_devices().await {
            Ok(devices) => Ok(Json(json!({ "devices": devices }))),
            Err(e) => Err((StatusCode::SERVICE_UNAVAILABLE, Json(json!({ "error": e })))),
        },
        _ => Err((StatusCode::UNAUTHORIZED, Json(json!({ "error": "Invalid or expired token" })))),
    }
}

pub async fn rgb_color_handler(
    State(db): State<Arc<Database>>,
    BearerToken(token): BearerToken,
    Json(payload): Json<RgbColorRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    match db.verify_token(&token) {
        Ok(true) => {
            let res = rgb::set_color(payload.r, payload.g, payload.b, payload.device_id).await;
            if res.success {
                Ok(Json(json!({ "success": true })))
            } else {
                Err((StatusCode::SERVICE_UNAVAILABLE, Json(json!({ "error": res.error }))))
            }
        }
        _ => Err((StatusCode::UNAUTHORIZED, Json(json!({ "error": "Invalid or expired token" })))),
    }
}

pub async fn rgb_off_handler(
    State(db): State<Arc<Database>>,
    BearerToken(token): BearerToken,
    Json(payload): Json<RgbOffRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    match db.verify_token(&token) {
        Ok(true) => {
            let res = rgb::turn_off(payload.device_id).await;
            if res.success {
                Ok(Json(json!({ "success": true })))
            } else {
                Err((StatusCode::SERVICE_UNAVAILABLE, Json(json!({ "error": res.error }))))
            }
        }
        _ => Err((StatusCode::UNAUTHORIZED, Json(json!({ "error": "Invalid or expired token" })))),
    }
}

pub async fn delete_app_handler(
    State(db): State<Arc<Database>>,
    BearerToken(token): BearerToken,
    Json(payload): Json<AppDeleteRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    match db.verify_token(&token) {
        Ok(true) => match db.delete_app(&payload.name) {
            Ok(true) => Ok(Json(json!({ "success": true }))),
            Ok(false) => Err((
                StatusCode::NOT_FOUND,
                Json(json!({ "error": format!("App '{}' non trouvée", payload.name) })),
            )),
            Err(e) => Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )),
        },
        _ => Err((StatusCode::UNAUTHORIZED, Json(json!({ "error": "Invalid or expired token" })))),
    }
}
