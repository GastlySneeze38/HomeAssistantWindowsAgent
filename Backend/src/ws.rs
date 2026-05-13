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
use std::sync::Arc;
use tokio::time::{interval, Duration};

use crate::database::Database;
use crate::system::get_available_ram;

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
        _ => {
            // Refuse la connexion WS si token invalide
            (
                StatusCode::UNAUTHORIZED,
                json!({"error": "Invalid or expired token"}).to_string(),
            )
                .into_response()
        }
    }
}

async fn handle_socket(mut socket: WebSocket) {
    let mut tick = interval(Duration::from_secs(1));

    loop {
        tokio::select! {
            _ = tick.tick() => {
                let msg = WsMessage {
                    msg_type: "system_update",
                    data: json!({ "available_ram_gb": get_available_ram() }),
                };

                let Ok(payload) = serde_json::to_string(&msg) else { break };

                if socket.send(Message::Text(payload.into())).await.is_err() {
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
