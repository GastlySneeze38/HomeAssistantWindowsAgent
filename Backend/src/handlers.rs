use axum::{extract::Json, response::IntoResponse};
use crate::launcher::{launch_application, LaunchRequest};
use crate::system::{SystemInfo, get_available_ram};

pub async fn health_handler() -> impl IntoResponse {
    "OK"
}

pub async fn system_handler() -> Json<SystemInfo> {
    let available_ram_gb = get_available_ram();

    Json(SystemInfo {
        available_ram_gb,
    })
}

pub async fn launch_handler(payload: Json<LaunchRequest>) -> Json<crate::launcher::LaunchResponse> {
    let response = launch_application(payload.0);
    Json(response)
}