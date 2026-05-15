use std::collections::HashSet;
use std::sync::Arc;
use tokio::time::{sleep, Duration};
use sysinfo::{System, SystemExt, ProcessExt};

use crate::core::database::{Database, GameProfile};
use crate::actions::rgb;
use crate::actions::youtube_music::{play_playlist, PlayPlaylistRequest};
use crate::actions::discord::join_voice_channel;

/// Démarre la tâche de fond qui surveille les processus toutes les 3 secondes.
/// Quand un processus correspondant à un profil activé apparaît, les actions du profil sont déclenchées.
pub fn start_automation_monitor(db: Arc<Database>) {
    tokio::spawn(async move {
        let mut active_profiles: HashSet<i32> = HashSet::new();
        let mut sys = System::new_all();

        loop {
            sleep(Duration::from_secs(3)).await;

            sys.refresh_processes();
            let running: HashSet<String> = sys
                .processes()
                .values()
                .map(|p| p.name().to_lowercase())
                .collect();

            let profiles = match db.get_game_profiles() {
                Ok(p) => p,
                Err(_) => continue,
            };

            for profile in &profiles {
                if !profile.enabled {
                    active_profiles.remove(&profile.id);
                    continue;
                }

                let process_lower = profile.process_name.to_lowercase();
                let is_running = running.iter().any(|name| name.contains(&process_lower));

                if is_running && !active_profiles.contains(&profile.id) {
                    // Profil vient de devenir actif → déclencher les actions
                    active_profiles.insert(profile.id);
                    println!("[Automation] Profil '{}' déclenché (processus: {})", profile.name, profile.process_name);
                    trigger_profile_actions(profile, &db).await;
                } else if !is_running {
                    active_profiles.remove(&profile.id);
                }
            }
        }
    });
}

async fn trigger_profile_actions(profile: &GameProfile, db: &Arc<Database>) {
    // RGB
    if profile.rgb_enabled {
        if let Some(hex) = &profile.rgb_color {
            if let Some((r, g, b)) = parse_hex_color(hex) {
                rgb::set_color(r, g, b, None).await;
            }
        }
    }

    // YouTube Music
    if let Some(playlist_id) = &profile.youtube_playlist_id {
        if !playlist_id.is_empty() {
            play_playlist(PlayPlaylistRequest { playlist_id: playlist_id.clone() });
        }
    }

    // Discord join voice
    if let (Some(guild_id), Some(channel_id)) = (&profile.discord_guild_id, &profile.discord_voice_channel_id) {
        if !guild_id.is_empty() && !channel_id.is_empty() {
            let app_id = db.get_discord_config("app_id").ok().flatten();
            let client_secret = db.get_discord_config("client_secret").ok().flatten();

            if let (Some(app_id), Some(client_secret)) = (app_id, client_secret) {
                join_voice_channel(
                    &app_id,
                    &client_secret,
                    None,
                    None,
                    guild_id,
                    channel_id,
                ).await;
            }
        }
    }
}

fn parse_hex_color(hex: &str) -> Option<(u8, u8, u8)> {
    let hex = hex.trim_start_matches('#');
    if hex.len() != 6 { return None; }
    let r = u8::from_str_radix(&hex[0..2], 16).ok()?;
    let g = u8::from_str_radix(&hex[2..4], 16).ok()?;
    let b = u8::from_str_radix(&hex[4..6], 16).ok()?;
    Some((r, g, b))
}
