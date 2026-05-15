use axum::{extract::{Json, State}, response::IntoResponse, http::StatusCode};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;
use crate::actions::close::{close_application, CloseRequest};
use crate::actions::launcher::{launch_application, LaunchRequest};
use crate::actions::youtube_music::{play_playlist, PlayPlaylistRequest};
use crate::core::auth::{LoginRequest, LoginResponse};
use crate::core::middleware::BearerToken;
use crate::actions::rgb;
use crate::actions::discord::{
    send_discord_message, join_voice_channel, fetch_guild_roles, fetch_guild_members,
    SendMessageRequest, JoinVoiceRequest,
};
use crate::core::database::{Database, AppEntry, DiscordRole, DiscordMember, YoutubePlaylist};

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

// --- Discord handlers ---

#[derive(Deserialize)]
pub struct DiscordConfigRequest {
    pub bot_token: Option<String>,
    pub app_id: Option<String>,
    pub client_secret: Option<String>,
}

pub async fn discord_get_config_handler(
    State(db): State<Arc<Database>>,
    BearerToken(token): BearerToken,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    match db.verify_token(&token) {
        Ok(true) => {
            let bot_configured = db.get_discord_config("bot_token").unwrap_or(None).is_some();
            let app_id_configured = db.get_discord_config("app_id").unwrap_or(None).is_some();
            let secret_configured = db.get_discord_config("client_secret").unwrap_or(None).is_some();
            Ok(Json(json!({
                "bot_configured": bot_configured,
                "app_id_configured": app_id_configured,
                "secret_configured": secret_configured
            })))
        }
        _ => Err((StatusCode::UNAUTHORIZED, Json(json!({ "error": "Invalid or expired token" })))),
    }
}

pub async fn discord_set_config_handler(
    State(db): State<Arc<Database>>,
    BearerToken(token): BearerToken,
    Json(payload): Json<DiscordConfigRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    match db.verify_token(&token) {
        Ok(true) => {
            let keys: &[(&str, &Option<String>)] = &[
                ("bot_token", &payload.bot_token),
                ("app_id", &payload.app_id),
                ("client_secret", &payload.client_secret),
            ];
            for (key, val) in keys {
                if let Some(v) = val {
                    if let Err(e) = db.set_discord_config(key, v) {
                        return Err((StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))));
                    }
                }
            }
            Ok(Json(json!({ "success": true })))
        }
        _ => Err((StatusCode::UNAUTHORIZED, Json(json!({ "error": "Invalid or expired token" })))),
    }
}

pub async fn discord_send_message_handler(
    State(db): State<Arc<Database>>,
    BearerToken(token): BearerToken,
    Json(payload): Json<SendMessageRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    match db.get_user_id_from_token(&token) {
        Ok(Some(user_id)) => {
            let bot_token = match db.get_discord_config("bot_token").unwrap_or(None) {
                Some(t) => t,
                None => return Err((
                    StatusCode::BAD_REQUEST,
                    Json(json!({ "error": "Bot token non configuré" })),
                )),
            };
            let result = send_discord_message(&bot_token, &payload.channel_id, &payload.message).await;
            let _ = db.add_entry(
                user_id,
                "discord_message",
                &format!("#{} → {}", payload.channel_id, payload.message),
                result.success,
                result.error.clone(),
            );
            Ok(Json(json!({ "success": result.success, "error": result.error })))
        }
        _ => Err((StatusCode::UNAUTHORIZED, Json(json!({ "error": "Invalid or expired token" })))),
    }
}

pub async fn discord_join_voice_handler(
    State(db): State<Arc<Database>>,
    BearerToken(token): BearerToken,
    Json(payload): Json<JoinVoiceRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    match db.get_user_id_from_token(&token) {
        Ok(Some(user_id)) => {
            let app_id = match db.get_discord_config("app_id").unwrap_or(None) {
                Some(id) => id,
                None => return Err((StatusCode::BAD_REQUEST, Json(json!({ "error": "Application ID non configuré" })))),
            };
            let client_secret = match db.get_discord_config("client_secret").unwrap_or(None) {
                Some(s) => s,
                None => return Err((StatusCode::BAD_REQUEST, Json(json!({ "error": "Client Secret non configuré" })))),
            };
            let stored_access = db.get_discord_config("rpc_access_token").unwrap_or(None);
            let stored_refresh = db.get_discord_config("rpc_refresh_token").unwrap_or(None);

            let result = join_voice_channel(
                &app_id,
                &client_secret,
                stored_access.as_deref(),
                stored_refresh.as_deref(),
                &payload.guild_id,
                &payload.channel_id,
            ).await;

            // Persist any new tokens obtained during the flow
            if let Some(ref at) = result.new_access_token {
                let _ = db.set_discord_config("rpc_access_token", at);
            }
            if let Some(ref rt) = result.new_refresh_token {
                let _ = db.set_discord_config("rpc_refresh_token", rt);
            }

            let _ = db.add_entry(
                user_id,
                "discord_voice",
                &format!("guild:{} channel:{}", payload.guild_id, payload.channel_id),
                result.success,
                result.error.clone(),
            );
            Ok(Json(json!({ "success": result.success, "error": result.error })))
        }
        _ => Err((StatusCode::UNAUTHORIZED, Json(json!({ "error": "Invalid or expired token" })))),
    }
}

// ── Discord roles handlers ────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct DiscordRoleUpsertRequest {
    pub guild_id: String,
    pub role_id: String,
    pub name: String,
}

#[derive(Deserialize)]
pub struct DiscordRoleDeleteRequest {
    pub role_id: String,
}

#[derive(Deserialize)]
pub struct DiscordFetchRequest {
    pub guild_id: String,
}

#[derive(Deserialize)]
pub struct DiscordMemberUpsertRequest {
    pub user_id: String,
    pub name: String,
}

#[derive(Deserialize)]
pub struct DiscordMemberDeleteRequest {
    pub user_id: String,
}

pub async fn discord_get_roles_handler(
    State(db): State<Arc<Database>>,
    BearerToken(token): BearerToken,
) -> Result<Json<Vec<DiscordRole>>, (StatusCode, Json<Value>)> {
    match db.verify_token(&token) {
        Ok(true) => Ok(Json(db.get_discord_roles().unwrap_or_default())),
        _ => Err((StatusCode::UNAUTHORIZED, Json(json!({ "error": "Invalid or expired token" })))),
    }
}

pub async fn discord_upsert_role_handler(
    State(db): State<Arc<Database>>,
    BearerToken(token): BearerToken,
    Json(payload): Json<DiscordRoleUpsertRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    match db.verify_token(&token) {
        Ok(true) => match db.upsert_discord_role(&payload.guild_id, &payload.role_id, &payload.name) {
            Ok(_) => Ok(Json(json!({ "success": true }))),
            Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() })))),
        },
        _ => Err((StatusCode::UNAUTHORIZED, Json(json!({ "error": "Invalid or expired token" })))),
    }
}

pub async fn discord_delete_role_handler(
    State(db): State<Arc<Database>>,
    BearerToken(token): BearerToken,
    Json(payload): Json<DiscordRoleDeleteRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    match db.verify_token(&token) {
        Ok(true) => match db.delete_discord_role(&payload.role_id) {
            Ok(_) => Ok(Json(json!({ "success": true }))),
            Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() })))),
        },
        _ => Err((StatusCode::UNAUTHORIZED, Json(json!({ "error": "Invalid or expired token" })))),
    }
}

pub async fn discord_fetch_roles_handler(
    State(db): State<Arc<Database>>,
    BearerToken(token): BearerToken,
    Json(payload): Json<DiscordFetchRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    match db.verify_token(&token) {
        Ok(true) => {
            let bot_token = match db.get_discord_config("bot_token").unwrap_or(None) {
                Some(t) => t,
                None => return Err((StatusCode::BAD_REQUEST, Json(json!({ "error": "Bot token non configuré" })))),
            };
            match fetch_guild_roles(&bot_token, &payload.guild_id).await {
                Ok(roles) => {
                    let mut count = 0;
                    for r in &roles {
                        if r.name != "@everyone" {
                            let _ = db.upsert_discord_role(&payload.guild_id, &r.role_id, &r.name);
                            count += 1;
                        }
                    }
                    Ok(Json(json!({ "success": true, "imported": count })))
                }
                Err(e) => Err((StatusCode::SERVICE_UNAVAILABLE, Json(json!({ "error": e })))),
            }
        }
        _ => Err((StatusCode::UNAUTHORIZED, Json(json!({ "error": "Invalid or expired token" })))),
    }
}

// ── Discord members handlers ──────────────────────────────────────────────────

pub async fn discord_get_members_handler(
    State(db): State<Arc<Database>>,
    BearerToken(token): BearerToken,
) -> Result<Json<Vec<DiscordMember>>, (StatusCode, Json<Value>)> {
    match db.verify_token(&token) {
        Ok(true) => Ok(Json(db.get_discord_members().unwrap_or_default())),
        _ => Err((StatusCode::UNAUTHORIZED, Json(json!({ "error": "Invalid or expired token" })))),
    }
}

pub async fn discord_upsert_member_handler(
    State(db): State<Arc<Database>>,
    BearerToken(token): BearerToken,
    Json(payload): Json<DiscordMemberUpsertRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    match db.verify_token(&token) {
        Ok(true) => match db.upsert_discord_member(&payload.user_id, &payload.name) {
            Ok(_) => Ok(Json(json!({ "success": true }))),
            Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() })))),
        },
        _ => Err((StatusCode::UNAUTHORIZED, Json(json!({ "error": "Invalid or expired token" })))),
    }
}

pub async fn discord_delete_member_handler(
    State(db): State<Arc<Database>>,
    BearerToken(token): BearerToken,
    Json(payload): Json<DiscordMemberDeleteRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    match db.verify_token(&token) {
        Ok(true) => match db.delete_discord_member(&payload.user_id) {
            Ok(_) => Ok(Json(json!({ "success": true }))),
            Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() })))),
        },
        _ => Err((StatusCode::UNAUTHORIZED, Json(json!({ "error": "Invalid or expired token" })))),
    }
}

pub async fn discord_fetch_members_handler(
    State(db): State<Arc<Database>>,
    BearerToken(token): BearerToken,
    Json(payload): Json<DiscordFetchRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    match db.verify_token(&token) {
        Ok(true) => {
            let bot_token = match db.get_discord_config("bot_token").unwrap_or(None) {
                Some(t) => t,
                None => return Err((StatusCode::BAD_REQUEST, Json(json!({ "error": "Bot token non configuré" })))),
            };
            match fetch_guild_members(&bot_token, &payload.guild_id).await {
                Ok(members) => {
                    let count = members.len();
                    for m in &members {
                        let _ = db.upsert_discord_member(&m.user_id, &m.name);
                    }
                    Ok(Json(json!({ "success": true, "imported": count })))
                }
                Err(e) => Err((StatusCode::SERVICE_UNAVAILABLE, Json(json!({ "error": e })))),
            }
        }
        _ => Err((StatusCode::UNAUTHORIZED, Json(json!({ "error": "Invalid or expired token" })))),
    }
}

// --- YouTube Music handlers ---

#[derive(Deserialize)]
pub struct YoutubePlaylistSaveRequest {
    pub name: String,
    pub playlist_id: String,
}

#[derive(Deserialize)]
pub struct YoutubePlaylistDeleteRequest {
    pub playlist_id: String,
}

pub async fn youtube_get_playlists_handler(
    State(db): State<Arc<Database>>,
    BearerToken(token): BearerToken,
) -> Result<Json<Vec<YoutubePlaylist>>, (StatusCode, Json<Value>)> {
    match db.verify_token(&token) {
        Ok(true) => Ok(Json(db.get_youtube_playlists().unwrap_or_default())),
        _ => Err((StatusCode::UNAUTHORIZED, Json(json!({ "error": "Invalid or expired token" })))),
    }
}

pub async fn youtube_add_playlist_handler(
    State(db): State<Arc<Database>>,
    BearerToken(token): BearerToken,
    Json(payload): Json<YoutubePlaylistSaveRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    match db.verify_token(&token) {
        Ok(true) => match db.add_youtube_playlist(&payload.name, &payload.playlist_id) {
            Ok(_) => Ok(Json(json!({ "success": true }))),
            Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() })))),
        },
        _ => Err((StatusCode::UNAUTHORIZED, Json(json!({ "error": "Invalid or expired token" })))),
    }
}

pub async fn youtube_delete_playlist_handler(
    State(db): State<Arc<Database>>,
    BearerToken(token): BearerToken,
    Json(payload): Json<YoutubePlaylistDeleteRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    match db.verify_token(&token) {
        Ok(true) => match db.delete_youtube_playlist(&payload.playlist_id) {
            Ok(true) => Ok(Json(json!({ "success": true }))),
            Ok(false) => Err((StatusCode::NOT_FOUND, Json(json!({ "error": "Playlist non trouvée" })))),
            Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() })))),
        },
        _ => Err((StatusCode::UNAUTHORIZED, Json(json!({ "error": "Invalid or expired token" })))),
    }
}

pub async fn youtube_play_playlist_handler(
    State(db): State<Arc<Database>>,
    BearerToken(token): BearerToken,
    Json(payload): Json<PlayPlaylistRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    match db.get_user_id_from_token(&token) {
        Ok(Some(user_id)) => {
            let response = play_playlist(payload.clone());
            let _ = db.add_entry(
                user_id,
                "youtube_playlist",
                &format!("playlist:{}", payload.playlist_id),
                response.success,
                response.error.clone(),
            );
            Ok(Json(json!({ "success": response.success, "error": response.error })))
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
