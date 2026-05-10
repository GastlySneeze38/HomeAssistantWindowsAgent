use axum::{extract::{Json, State}, response::IntoResponse};
use std::sync::Arc;
use crate::close::{close_application, CloseRequest};
use crate::database::Database;
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

pub async fn launch_handler(
    State(db): State<Arc<Database>>,
    payload: Json<LaunchRequest>,
) -> Json<crate::launcher::LaunchResponse> {
    let response = launch_application(payload.0.clone());
    
    let _ = db.add_entry(
        "launch",
        &payload.0.command,
        response.success,
        response.error.clone(),
    );

    Json(response)
}

pub async fn close_handler(
    State(db): State<Arc<Database>>,
    payload: Json<CloseRequest>,
) -> Json<crate::close::CloseResponse> {
    let response = close_application(payload.0.clone());
    let _ = db.add_entry(
        "close",
        &payload.0.command,
        response.success,
        response.error.clone(),
    );
    Json(response)
}

pub async fn history_handler(
    State(db): State<Arc<Database>>,
) -> Json<Vec<crate::database::HistoryEntry>> {
    match db.get_history(100) {
        Ok(entries) => Json(entries),
        Err(_) => Json(vec![]),
    }
}