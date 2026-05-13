use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Query, State,
    },
    response::IntoResponse,
    http::StatusCode,
};
use serde::Serialize;
use serde_json::json;
use std::sync::{Arc, Mutex};
use tokio::time::{interval, Duration};

use crate::core::database::Database;
use crate::monitoring::dashboard::DashboardCollector;

#[derive(serde::Deserialize)]
pub struct WsQuery {
    token: String,
}

#[derive(Serialize)]
struct WsMessage<T: Serialize> {
    #[serde(rename = "type")]
    msg_type: &'static str,
    data: T,
}

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    Query(params): Query<WsQuery>,
    State(db): State<Arc<Database>>,
) -> impl IntoResponse {
    match db.verify_token(&params.token) {
        Ok(true) => ws.on_upgrade(|socket| handle_socket(socket)),
        _ => (
            StatusCode::UNAUTHORIZED,
            json!({"error": "Invalid or expired token"}).to_string(),
        )
            .into_response(),
    }
}

async fn handle_socket(mut socket: WebSocket) {
    let mut tick = interval(Duration::from_secs(1));

    // Collecteur persistant — System et Networks réutilisés à chaque tick
    let collector = Arc::new(Mutex::new(DashboardCollector::new()));

    loop {
        tokio::select! {
            _ = tick.tick() => {
                let col = Arc::clone(&collector);

                let payload = tokio::task::spawn_blocking(move || {
                    let data = col.lock().unwrap().collect();
                    let msg = WsMessage { msg_type: "system_update", data };
                    serde_json::to_string(&msg)
                }).await;

                let text = match payload {
                    Ok(Ok(s)) => s,
                    _ => serde_json::to_string(&json!({
                        "type": "system_update",
                        "data": null
                    })).unwrap(),
                };

                if socket.send(Message::Text(text.into())).await.is_err() {
                    break;
                }
            }
            msg = socket.recv() => {
                match msg {
                    Some(Ok(Message::Close(_))) | None => break,
                    _ => {}
                }
            }
        }
    }
}
