use serde::{Deserialize, Serialize};
use std::io::{Read, Write};
use std::fs::OpenOptions;

#[derive(Deserialize, Clone)]
pub struct SendMessageRequest {
    pub channel_id: String,
    pub message: String,
}

#[derive(Deserialize, Clone)]
pub struct JoinVoiceRequest {
    pub guild_id: String,
    pub channel_id: String,
}

#[derive(Serialize)]
pub struct DiscordActionResponse {
    pub success: bool,
    pub error: Option<String>,
}

pub struct JoinVoiceResult {
    pub success: bool,
    pub error: Option<String>,
    pub new_access_token: Option<String>,
    pub new_refresh_token: Option<String>,
}

pub async fn send_discord_message(
    bot_token: &str,
    channel_id: &str,
    message: &str,
) -> DiscordActionResponse {
    let url = format!("https://discord.com/api/v10/channels/{}/messages", channel_id);
    let client = reqwest::Client::new();

    match client
        .post(&url)
        .header("Authorization", format!("Bot {}", bot_token))
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "content": message,
            "allowed_mentions": {
                "parse": ["users", "roles", "everyone"]
            }
        }))
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => DiscordActionResponse { success: true, error: None },
        Ok(resp) => {
            let status = resp.status().as_u16();
            let body = resp.text().await.unwrap_or_default();
            DiscordActionResponse {
                success: false,
                error: Some(format!("HTTP {}: {}", status, body)),
            }
        }
        Err(e) => DiscordActionResponse {
            success: false,
            error: Some(e.to_string()),
        },
    }
}

// ── Fetch from Discord API ───────────────────────────────────────────────────

#[derive(Serialize)]
pub struct FetchedRole {
    pub role_id: String,
    pub name: String,
}

#[derive(Serialize)]
pub struct FetchedMember {
    pub user_id: String,
    pub name: String,
}

pub async fn fetch_guild_roles(bot_token: &str, guild_id: &str) -> Result<Vec<FetchedRole>, String> {
    let client = reqwest::Client::new();
    let resp = client
        .get(format!("https://discord.com/api/v10/guilds/{}/roles", guild_id))
        .header("Authorization", format!("Bot {}", bot_token))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("HTTP error: {}", body));
    }

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let roles = json.as_array().ok_or("Réponse invalide")?
        .iter()
        .filter_map(|r| {
            Some(FetchedRole {
                role_id: r["id"].as_str()?.to_string(),
                name: r["name"].as_str()?.to_string(),
            })
        })
        .collect();
    Ok(roles)
}

pub async fn fetch_guild_members(bot_token: &str, guild_id: &str) -> Result<Vec<FetchedMember>, String> {
    let client = reqwest::Client::new();
    let resp = client
        .get(format!("https://discord.com/api/v10/guilds/{}/members?limit=1000", guild_id))
        .header("Authorization", format!("Bot {}", bot_token))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        let err = if body.contains("50001") || body.contains("Missing Access") {
            "Accès refusé (code 50001). Active l'intent « Server Members Intent » dans le Developer Portal → ton bot → Privileged Gateway Intents.".to_string()
        } else {
            format!("Erreur Discord : {}", body)
        };
        return Err(err);
    }

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let members = json.as_array().ok_or("Réponse invalide")?
        .iter()
        .filter_map(|m| {
            let user = m["user"].as_object()?;
            // Skip bots
            if user.get("bot").and_then(|b| b.as_bool()).unwrap_or(false) {
                return None;
            }
            let user_id = user["id"].as_str()?.to_string();
            // Prefer server nickname, fallback to global_name, then username
            let name = m["nick"].as_str()
                .or_else(|| user["global_name"].as_str())
                .or_else(|| user["username"].as_str())
                .unwrap_or("inconnu")
                .to_string();
            Some(FetchedMember { user_id, name })
        })
        .collect();
    Ok(members)
}

// ── RPC helpers ──────────────────────────────────────────────────────────────

fn rpc_write(pipe: &mut impl Write, opcode: u32, payload: &str) -> std::io::Result<()> {
    let bytes = payload.as_bytes();
    let mut frame = Vec::with_capacity(8 + bytes.len());
    frame.extend_from_slice(&opcode.to_le_bytes());
    frame.extend_from_slice(&(bytes.len() as u32).to_le_bytes());
    frame.extend_from_slice(bytes);
    pipe.write_all(&frame)
}

fn rpc_read(pipe: &mut impl Read) -> std::io::Result<serde_json::Value> {
    let mut header = [0u8; 8];
    pipe.read_exact(&mut header)?;
    let len = u32::from_le_bytes(header[4..8].try_into().unwrap()) as usize;
    let mut payload = vec![0u8; len];
    pipe.read_exact(&mut payload)?;
    serde_json::from_slice(&payload).map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))
}

fn open_rpc_pipe() -> Option<std::fs::File> {
    for i in 0..10 {
        let path = format!(r"\\.\pipe\discord-ipc-{}", i);
        if let Ok(f) = OpenOptions::new().read(true).write(true).open(&path) {
            return Some(f);
        }
    }
    None
}

async fn exchange_code_for_token(
    app_id: &str,
    client_secret: &str,
    code: &str,
) -> Result<(String, String), String> {
    let client = reqwest::Client::new();
    let params = [
        ("client_id", app_id),
        ("client_secret", client_secret),
        ("grant_type", "authorization_code"),
        ("code", code),
    ];
    let resp = client
        .post("https://discord.com/api/oauth2/token")
        .form(&params)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let access = json["access_token"].as_str().ok_or("Pas d'access_token dans la réponse")?.to_string();
    let refresh = json["refresh_token"].as_str().unwrap_or("").to_string();
    Ok((access, refresh))
}

async fn refresh_access_token(
    app_id: &str,
    client_secret: &str,
    refresh_token: &str,
) -> Result<(String, String), String> {
    let client = reqwest::Client::new();
    let params = [
        ("client_id", app_id),
        ("client_secret", client_secret),
        ("grant_type", "refresh_token"),
        ("refresh_token", refresh_token),
    ];
    let resp = client
        .post("https://discord.com/api/oauth2/token")
        .form(&params)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let access = json["access_token"].as_str().ok_or("Pas d'access_token dans la réponse")?.to_string();
    let refresh = json["refresh_token"].as_str().unwrap_or(refresh_token).to_string();
    Ok((access, refresh))
}

pub async fn join_voice_channel(
    app_id: &str,
    client_secret: &str,
    stored_access_token: Option<&str>,
    stored_refresh_token: Option<&str>,
    guild_id: &str,
    channel_id: &str,
) -> JoinVoiceResult {
    let mut pipe = match open_rpc_pipe() {
        Some(p) => p,
        None => return JoinVoiceResult {
            success: false,
            error: Some("Impossible de se connecter au client Discord. Assure-toi que Discord est ouvert.".to_string()),
            new_access_token: None,
            new_refresh_token: None,
        },
    };

    // Handshake
    let handshake = serde_json::json!({ "v": 1, "client_id": app_id }).to_string();
    if let Err(e) = rpc_write(&mut pipe, 0, &handshake) {
        return JoinVoiceResult { success: false, error: Some(format!("Erreur handshake: {}", e)), new_access_token: None, new_refresh_token: None };
    }
    if let Err(e) = rpc_read(&mut pipe) {
        return JoinVoiceResult { success: false, error: Some(format!("Erreur lecture READY: {}", e)), new_access_token: None, new_refresh_token: None };
    }

    // Try to authenticate with stored token (or refreshed token)
    let mut final_access_token: Option<String> = None;
    let mut final_refresh_token: Option<String> = stored_refresh_token.map(|s| s.to_string());
    let mut authenticated = false;

    // First try: use stored access token
    if let Some(access_token) = stored_access_token {
        let nonce = uuid::Uuid::new_v4().to_string();
        let auth_cmd = serde_json::json!({
            "cmd": "AUTHENTICATE",
            "args": { "access_token": access_token },
            "nonce": nonce
        }).to_string();
        if rpc_write(&mut pipe, 1, &auth_cmd).is_ok() {
            if let Ok(resp) = rpc_read(&mut pipe) {
                if resp["evt"].as_str() != Some("ERROR") {
                    authenticated = true;
                    final_access_token = Some(access_token.to_string());
                }
            }
        }
    }

    // Second try: refresh token
    if !authenticated {
        if let Some(ref refresh_token) = final_refresh_token.clone() {
            if !refresh_token.is_empty() {
                match refresh_access_token(app_id, client_secret, refresh_token).await {
                    Ok((new_access, new_refresh)) => {
                        // Re-open pipe since the previous AUTHENTICATE attempt may have consumed the session
                        drop(pipe);
                        pipe = match open_rpc_pipe() {
                            Some(p) => p,
                            None => return JoinVoiceResult {
                                success: false,
                                error: Some("Impossible de rouvrir le pipe Discord.".to_string()),
                                new_access_token: None, new_refresh_token: None,
                            },
                        };
                        let handshake = serde_json::json!({ "v": 1, "client_id": app_id }).to_string();
                        let _ = rpc_write(&mut pipe, 0, &handshake);
                        let _ = rpc_read(&mut pipe);

                        let nonce = uuid::Uuid::new_v4().to_string();
                        let auth_cmd = serde_json::json!({
                            "cmd": "AUTHENTICATE",
                            "args": { "access_token": new_access },
                            "nonce": nonce
                        }).to_string();
                        if rpc_write(&mut pipe, 1, &auth_cmd).is_ok() {
                            if let Ok(resp) = rpc_read(&mut pipe) {
                                if resp["evt"].as_str() != Some("ERROR") {
                                    authenticated = true;
                                    final_access_token = Some(new_access.clone());
                                    final_refresh_token = Some(new_refresh);
                                }
                            }
                        }
                    }
                    Err(_) => {}
                }
            }
        }
    }

    // Third try: full AUTHORIZE flow (user must click in Discord)
    if !authenticated {
        drop(pipe);
        pipe = match open_rpc_pipe() {
            Some(p) => p,
            None => return JoinVoiceResult {
                success: false,
                error: Some("Impossible de rouvrir le pipe Discord.".to_string()),
                new_access_token: None, new_refresh_token: None,
            },
        };
        let handshake = serde_json::json!({ "v": 1, "client_id": app_id }).to_string();
        let _ = rpc_write(&mut pipe, 0, &handshake);
        let _ = rpc_read(&mut pipe);

        let nonce = uuid::Uuid::new_v4().to_string();
        let authorize_cmd = serde_json::json!({
            "cmd": "AUTHORIZE",
            "args": {
                "client_id": app_id,
                "scopes": ["rpc", "rpc.voice.write"]
            },
            "nonce": nonce
        }).to_string();

        if let Err(e) = rpc_write(&mut pipe, 1, &authorize_cmd) {
            return JoinVoiceResult { success: false, error: Some(format!("Erreur AUTHORIZE: {}", e)), new_access_token: None, new_refresh_token: None };
        }

        // This blocks until the user clicks "Authorize" in Discord
        let auth_resp = match rpc_read(&mut pipe) {
            Ok(r) => r,
            Err(e) => return JoinVoiceResult { success: false, error: Some(format!("Erreur lecture AUTHORIZE: {}", e)), new_access_token: None, new_refresh_token: None },
        };

        if auth_resp["evt"].as_str() == Some("ERROR") {
            return JoinVoiceResult {
                success: false,
                error: Some(format!("AUTHORIZE refusé: {}", auth_resp["data"]["message"].as_str().unwrap_or("inconnu"))),
                new_access_token: None, new_refresh_token: None,
            };
        }

        let code = match auth_resp["data"]["code"].as_str() {
            Some(c) => c.to_string(),
            None => return JoinVoiceResult {
                success: false,
                error: Some(format!("Code absent dans la réponse AUTHORIZE: {}", auth_resp)),
                new_access_token: None, new_refresh_token: None,
            },
        };

        match exchange_code_for_token(app_id, client_secret, &code).await {
            Ok((access, refresh)) => {
                let nonce2 = uuid::Uuid::new_v4().to_string();
                let auth_cmd = serde_json::json!({
                    "cmd": "AUTHENTICATE",
                    "args": { "access_token": access },
                    "nonce": nonce2
                }).to_string();
                if rpc_write(&mut pipe, 1, &auth_cmd).is_ok() {
                    if let Ok(resp) = rpc_read(&mut pipe) {
                        if resp["evt"].as_str() != Some("ERROR") {
                            authenticated = true;
                            final_access_token = Some(access);
                            final_refresh_token = Some(refresh);
                        } else {
                            return JoinVoiceResult {
                                success: false,
                                error: Some(format!("AUTHENTICATE échoué: {}", resp["data"]["message"].as_str().unwrap_or("inconnu"))),
                                new_access_token: None, new_refresh_token: None,
                            };
                        }
                    }
                }
            }
            Err(e) => return JoinVoiceResult {
                success: false,
                error: Some(format!("Échange de token échoué: {}", e)),
                new_access_token: None, new_refresh_token: None,
            },
        }
    }

    if !authenticated {
        return JoinVoiceResult {
            success: false,
            error: Some("Authentification RPC échouée.".to_string()),
            new_access_token: None, new_refresh_token: None,
        };
    }

    // Send SELECT_VOICE_CHANNEL
    let nonce = uuid::Uuid::new_v4().to_string();
    let cmd = serde_json::json!({
        "cmd": "SELECT_VOICE_CHANNEL",
        "args": {
            "channel_id": channel_id,
            "guild_id": guild_id,
            "force": true
        },
        "nonce": nonce
    }).to_string();

    if let Err(e) = rpc_write(&mut pipe, 1, &cmd) {
        return JoinVoiceResult { success: false, error: Some(e.to_string()), new_access_token: final_access_token, new_refresh_token: final_refresh_token };
    }

    match rpc_read(&mut pipe) {
        Ok(resp) if resp["evt"].as_str() == Some("ERROR") => JoinVoiceResult {
            success: false,
            error: Some(format!("SELECT_VOICE_CHANNEL échoué: {}", resp["data"]["message"].as_str().unwrap_or("inconnu"))),
            new_access_token: final_access_token,
            new_refresh_token: final_refresh_token,
        },
        Ok(_) => JoinVoiceResult {
            success: true,
            error: None,
            new_access_token: final_access_token,
            new_refresh_token: final_refresh_token,
        },
        Err(e) => JoinVoiceResult {
            success: false,
            error: Some(e.to_string()),
            new_access_token: final_access_token,
            new_refresh_token: final_refresh_token,
        },
    }
}
