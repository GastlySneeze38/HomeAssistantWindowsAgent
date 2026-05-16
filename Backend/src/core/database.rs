use chrono::Utc;
use rusqlite::{params, Connection, Result as SqlResult};
use serde::Serialize;
use std::sync::Mutex;
use crate::core::auth::{verify_password, hash_password};

#[derive(Serialize, Clone)]
pub struct HistoryEntry {
    pub id: i32,
    pub user_id: i32,
    pub action_type: String,
    pub command: String,
    pub success: bool,
    pub error: Option<String>,
    pub timestamp: String,
}

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn new() -> SqlResult<Self> {
        let conn = Connection::open("App.db")?;
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS history (
                id INTEGER PRIMARY KEY,
                user_id INTEGER NOT NULL DEFAULT 0,
                action_type TEXT NOT NULL,
                command TEXT NOT NULL,
                success BOOLEAN NOT NULL,
                error TEXT,
                timestamp TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS tokens (
                id INTEGER PRIMARY KEY,
                token TEXT NOT NULL UNIQUE,
                user_id INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
            CREATE TABLE IF NOT EXISTS discord_config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS discord_roles (
                id INTEGER PRIMARY KEY,
                guild_id TEXT NOT NULL,
                role_id TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS discord_members (
                id INTEGER PRIMARY KEY,
                user_id TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS youtube_playlists (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                playlist_id TEXT NOT NULL UNIQUE
            );
            CREATE TABLE IF NOT EXISTS game_profiles (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                process_name TEXT NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 1,
                rgb_enabled INTEGER NOT NULL DEFAULT 0,
                rgb_color TEXT,
                discord_guild_id TEXT,
                discord_voice_channel_id TEXT,
                discord_message_channel_id TEXT,
                discord_message TEXT,
                youtube_playlist_id TEXT
            )",
        )?;
        // Migration: ajoute user_id si absent (DB existante)
        let _ = conn.execute(
            "ALTER TABLE history ADD COLUMN user_id INTEGER NOT NULL DEFAULT 0",
            [],
        );
        // Migration: ajoute les colonnes Discord message si absentes
        let _ = conn.execute("ALTER TABLE game_profiles ADD COLUMN discord_message_channel_id TEXT", []);
        let _ = conn.execute("ALTER TABLE game_profiles ADD COLUMN discord_message TEXT", []);

        Ok(Database {
            conn: Mutex::new(conn),
        })
    }

    pub fn add_entry(
        &self,
        user_id: i32,
        action_type: &str,
        command: &str,
        success: bool,
        error: Option<String>,
    ) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        let now = Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO history (user_id, action_type, command, success, error, timestamp)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![user_id, action_type, command, success, error, now],
        )?;

        Ok(())
    }

    pub fn get_history(&self, user_id: i32, limit: usize) -> SqlResult<Vec<HistoryEntry>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, user_id, action_type, command, success, error, timestamp
             FROM history
             WHERE user_id = ?1
             ORDER BY id DESC
             LIMIT ?2",
        )?;

        let entries = stmt
            .query_map(params![user_id, limit as i32], |row| {
                Ok(HistoryEntry {
                    id: row.get(0)?,
                    user_id: row.get(1)?,
                    action_type: row.get(2)?,
                    command: row.get(3)?,
                    success: row.get::<_, i32>(4)? != 0,
                    error: row.get(5)?,
                    timestamp: row.get(6)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(entries)
    }

    #[allow(dead_code)]
    pub fn clear_history(&self) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM history", [])?;
        Ok(())
    }

    pub fn login(&self, username: &str, password: &str) -> SqlResult<Option<String>> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn.prepare(
            "SELECT id, password_hash FROM users WHERE username = ?1"
        )?;

        let user: Option<(i32, String)> = stmt
            .query_row(params![username], |row| {
                Ok((row.get(0)?, row.get(1)?))
            })
            .ok();

        if let Some((user_id, stored_hash)) = user {
            if verify_password(password, &stored_hash) {
                let token = uuid::Uuid::new_v4().to_string();
                let created_at = Utc::now().to_rfc3339();
                let expires_at = (Utc::now() + chrono::Duration::days(7)).to_rfc3339();

                conn.execute(
                    "INSERT INTO tokens (token, user_id, created_at, expires_at)
                    VALUES (?1, ?2, ?3, ?4)",
                    params![token, user_id, created_at, expires_at],
                )?;

                return Ok(Some(token));
            }
        }

        Ok(None)
    }

    pub fn has_any_users(&self) -> SqlResult<bool> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id FROM users LIMIT 1")?;
        stmt.exists([])
    }

    pub fn user_exists(&self, username: &str) -> SqlResult<bool> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id FROM users WHERE username = ?1")?;
        stmt.exists(params![username])
    }

    pub fn get_user_id_from_token(&self, token: &str) -> SqlResult<Option<i32>> {
        let conn = self.conn.lock().unwrap();
        let now = Utc::now().to_rfc3339();

        let mut stmt = conn.prepare(
            "SELECT user_id FROM tokens WHERE token = ?1 AND expires_at > ?2"
        )?;
        let result = stmt.query_row(params![token, now], |row| row.get(0)).ok();

        Ok(result)
    }

    pub fn verify_token(&self, token: &str) -> SqlResult<bool> {
        let conn = self.conn.lock().unwrap();
        let now = Utc::now().to_rfc3339();

        let mut stmt = conn.prepare(
            "SELECT id FROM tokens WHERE token = ?1 AND expires_at > ?2"
        )?;
        let exists = stmt.exists(params![token, now])?;

        Ok(exists)
    }

    pub fn delete_token(&self, token: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();

        conn.execute(
            "DELETE FROM tokens WHERE token = ?1",
            params![token],
        )?;

        Ok(())
    }

    pub fn create_user(&self, username: &str, password: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        let password_hash = hash_password(password);

        conn.execute(
            "INSERT INTO users (username, password_hash) VALUES (?1, ?2)",
            params![username, password_hash],
        )?;
        Ok(())
    }

    pub fn delete_user(&self, username: &str, password: &str) -> SqlResult<bool> {
        let conn = self.conn.lock().unwrap();

        let stored_hash: Option<String> = {
            let mut stmt = conn.prepare(
                "SELECT password_hash FROM users WHERE username = ?1"
            )?;
            stmt.query_row(params![username], |row| row.get(0)).ok()
        };

        if let Some(hash) = stored_hash {
            if verify_password(password, &hash) {
                conn.execute(
                    "DELETE FROM users WHERE username = ?1",
                    params![username],
                )?;
                return Ok(true);
            }
        }

        Ok(false)
    }

    pub fn force_delete_user(&self, username: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "DELETE FROM tokens WHERE user_id = (SELECT id FROM users WHERE username = ?1)",
            params![username],
        )?;
        conn.execute("DELETE FROM users WHERE username = ?1", params![username])?;
        Ok(())
    }

    // --- Apps management ---

    pub fn init_apps_table(&self) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS apps (
                id              INTEGER PRIMARY KEY,
                name            TEXT NOT NULL UNIQUE,
                path            TEXT NOT NULL,
                args            TEXT,
                aliases         TEXT,
                close_processes TEXT
            )",
        )?;
        // Migrations for existing DBs
        let _ = conn.execute("ALTER TABLE apps ADD COLUMN aliases TEXT", []);
        let _ = conn.execute("ALTER TABLE apps ADD COLUMN close_processes TEXT", []);
        Ok(())
    }

    pub fn get_apps(&self) -> SqlResult<Vec<AppEntry>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, path, args, aliases, close_processes FROM apps ORDER BY name"
        )?;
        let entries = stmt
            .query_map([], |row| {
                Ok(AppEntry {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    path: row.get(2)?,
                    args: row.get(3)?,
                    aliases: row.get(4)?,
                    close_processes: row.get(5)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(entries)
    }

    pub fn get_app_by_name(&self, input: &str) -> SqlResult<Option<AppEntry>> {
        let conn = self.conn.lock().unwrap();
        let lower = input.to_lowercase();

        // Match exact name first, then search inside comma-separated aliases
        let mut stmt = conn.prepare(
            "SELECT id, name, path, args, aliases, close_processes FROM apps
             WHERE LOWER(name) = ?1
                OR (',' || LOWER(COALESCE(aliases,'')) || ',') LIKE '%,' || ?1 || ',%'"
        )?;

        let result = stmt.query_row(params![lower], |row| {
            Ok(AppEntry {
                id: row.get(0)?,
                name: row.get(1)?,
                path: row.get(2)?,
                args: row.get(3)?,
                aliases: row.get(4)?,
                close_processes: row.get(5)?,
            })
        }).ok();
        Ok(result)
    }

    pub fn add_app(&self, name: &str, path: &str, args: Option<&str>) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO apps (name, path, args) VALUES (?1, ?2, ?3)",
            params![name, path, args],
        )?;
        Ok(())
    }

    pub fn upsert_apps_from_scan(
        &self,
        apps: &[crate::actions::scanner::ScannedApp],
    ) -> SqlResult<(usize, usize)> {
        use crate::actions::scanner::{make_aliases, make_close_processes};
        let conn = self.conn.lock().unwrap();
        let mut inserted = 0usize;
        let mut updated = 0usize;

        for app in apps {
            let aliases = make_aliases(&app.name);
            let close_procs = make_close_processes(&app.command);

            let exists: bool = conn
                .query_row(
                    "SELECT COUNT(*) FROM apps WHERE LOWER(name) = LOWER(?1)",
                    rusqlite::params![app.name],
                    |row| row.get::<_, i32>(0),
                )
                .unwrap_or(0)
                > 0;

            if exists {
                conn.execute(
                    "UPDATE apps SET path=?1, aliases=?2, close_processes=?3 WHERE LOWER(name) = LOWER(?4)",
                    rusqlite::params![app.command, aliases, close_procs, app.name],
                )?;
                updated += 1;
            } else {
                conn.execute(
                    "INSERT INTO apps (name, path, aliases, close_processes) VALUES (?1, ?2, ?3, ?4)",
                    rusqlite::params![app.name, app.command, aliases, close_procs],
                )?;
                inserted += 1;
            }
        }

        Ok((inserted, updated))
    }

    pub fn delete_app(&self, name: &str) -> SqlResult<bool> {
        let conn = self.conn.lock().unwrap();
        let rows = conn.execute("DELETE FROM apps WHERE LOWER(name) = LOWER(?1)", params![name])?;
        Ok(rows > 0)
    }

    // --- Discord config ---

    pub fn get_discord_config(&self, key: &str) -> SqlResult<Option<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT value FROM discord_config WHERE key = ?1")?;
        Ok(stmt.query_row(params![key], |row| row.get(0)).ok())
    }

    // --- Discord roles ---

    pub fn get_discord_roles(&self) -> SqlResult<Vec<DiscordRole>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, guild_id, role_id, name FROM discord_roles ORDER BY name")?;
        let rows = stmt.query_map([], |row| Ok(DiscordRole {
            id: row.get(0)?,
            guild_id: row.get(1)?,
            role_id: row.get(2)?,
            name: row.get(3)?,
        }))?.collect::<Result<Vec<_>, _>>()?;
        Ok(rows)
    }

    pub fn upsert_discord_role(&self, guild_id: &str, role_id: &str, name: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO discord_roles (guild_id, role_id, name) VALUES (?1, ?2, ?3)
             ON CONFLICT(role_id) DO UPDATE SET name = excluded.name, guild_id = excluded.guild_id",
            params![guild_id, role_id, name],
        )?;
        Ok(())
    }

    pub fn delete_discord_role(&self, role_id: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM discord_roles WHERE role_id = ?1", params![role_id])?;
        Ok(())
    }

    // --- Discord members ---

    pub fn get_discord_members(&self) -> SqlResult<Vec<DiscordMember>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, user_id, name FROM discord_members ORDER BY name")?;
        let rows = stmt.query_map([], |row| Ok(DiscordMember {
            id: row.get(0)?,
            user_id: row.get(1)?,
            name: row.get(2)?,
        }))?.collect::<Result<Vec<_>, _>>()?;
        Ok(rows)
    }

    pub fn upsert_discord_member(&self, user_id: &str, name: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO discord_members (user_id, name) VALUES (?1, ?2)
             ON CONFLICT(user_id) DO UPDATE SET name = excluded.name",
            params![user_id, name],
        )?;
        Ok(())
    }

    pub fn delete_discord_member(&self, user_id: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM discord_members WHERE user_id = ?1", params![user_id])?;
        Ok(())
    }

    // --- YouTube playlists ---

    pub fn get_youtube_playlists(&self) -> SqlResult<Vec<YoutubePlaylist>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, name, playlist_id FROM youtube_playlists ORDER BY name")?;
        let rows = stmt.query_map([], |row| Ok(YoutubePlaylist {
            id: row.get(0)?,
            name: row.get(1)?,
            playlist_id: row.get(2)?,
        }))?.collect::<Result<Vec<_>, _>>()?;
        Ok(rows)
    }

    pub fn add_youtube_playlist(&self, name: &str, playlist_id: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO youtube_playlists (name, playlist_id) VALUES (?1, ?2)
             ON CONFLICT(playlist_id) DO UPDATE SET name = excluded.name",
            params![name, playlist_id],
        )?;
        Ok(())
    }

    pub fn delete_youtube_playlist(&self, playlist_id: &str) -> SqlResult<bool> {
        let conn = self.conn.lock().unwrap();
        let rows = conn.execute("DELETE FROM youtube_playlists WHERE playlist_id = ?1", params![playlist_id])?;
        Ok(rows > 0)
    }

    pub fn set_discord_config(&self, key: &str, value: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO discord_config (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        )?;
        Ok(())
    }

    // --- Game profiles (automation) ---

    pub fn get_game_profiles(&self) -> SqlResult<Vec<GameProfile>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, process_name, enabled, rgb_enabled, rgb_color,
                    discord_guild_id, discord_voice_channel_id,
                    discord_message_channel_id, discord_message, youtube_playlist_id
             FROM game_profiles ORDER BY name"
        )?;
        let rows = stmt.query_map([], |row| Ok(GameProfile {
            id: row.get(0)?,
            name: row.get(1)?,
            process_name: row.get(2)?,
            enabled: row.get::<_, i32>(3)? != 0,
            rgb_enabled: row.get::<_, i32>(4)? != 0,
            rgb_color: row.get(5)?,
            discord_guild_id: row.get(6)?,
            discord_voice_channel_id: row.get(7)?,
            discord_message_channel_id: row.get(8)?,
            discord_message: row.get(9)?,
            youtube_playlist_id: row.get(10)?,
        }))?.collect::<Result<Vec<_>, _>>()?;
        Ok(rows)
    }

    pub fn add_game_profile(&self, p: &GameProfile) -> SqlResult<i64> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO game_profiles
             (name, process_name, enabled, rgb_enabled, rgb_color,
              discord_guild_id, discord_voice_channel_id,
              discord_message_channel_id, discord_message, youtube_playlist_id)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
            params![
                p.name, p.process_name,
                p.enabled as i32, p.rgb_enabled as i32,
                p.rgb_color, p.discord_guild_id,
                p.discord_voice_channel_id,
                p.discord_message_channel_id, p.discord_message,
                p.youtube_playlist_id
            ],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn update_game_profile(&self, p: &GameProfile) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE game_profiles SET
             name=?1, process_name=?2, enabled=?3, rgb_enabled=?4, rgb_color=?5,
             discord_guild_id=?6, discord_voice_channel_id=?7,
             discord_message_channel_id=?8, discord_message=?9, youtube_playlist_id=?10
             WHERE id=?11",
            params![
                p.name, p.process_name,
                p.enabled as i32, p.rgb_enabled as i32,
                p.rgb_color, p.discord_guild_id,
                p.discord_voice_channel_id,
                p.discord_message_channel_id, p.discord_message,
                p.youtube_playlist_id,
                p.id
            ],
        )?;
        Ok(())
    }

    pub fn delete_game_profile(&self, id: i32) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM game_profiles WHERE id=?1", params![id])?;
        Ok(())
    }
}

#[derive(Serialize, Clone)]
pub struct DiscordRole {
    pub id: i32,
    pub guild_id: String,
    pub role_id: String,
    pub name: String,
}

#[derive(Serialize, Clone)]
pub struct DiscordMember {
    pub id: i32,
    pub user_id: String,
    pub name: String,
}

#[derive(Serialize, Clone)]
pub struct YoutubePlaylist {
    pub id: i32,
    pub name: String,
    pub playlist_id: String,
}


#[derive(Serialize, Clone)]
pub struct AppEntry {
    pub id: i32,
    pub name: String,
    pub path: String,
    pub args: Option<String>,
    pub aliases: Option<String>,
    pub close_processes: Option<String>,
}

#[derive(Serialize, Clone, serde::Deserialize)]
pub struct GameProfile {
    pub id: i32,
    pub name: String,
    pub process_name: String,
    pub enabled: bool,
    pub rgb_enabled: bool,
    pub rgb_color: Option<String>,
    pub discord_guild_id: Option<String>,
    pub discord_voice_channel_id: Option<String>,
    pub discord_message_channel_id: Option<String>,
    pub discord_message: Option<String>,
    pub youtube_playlist_id: Option<String>,
}
