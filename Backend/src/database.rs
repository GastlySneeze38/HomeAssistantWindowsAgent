use chrono::Utc;
use rusqlite::{params, Connection, Result as SqlResult};
use serde::Serialize;
use std::sync::Mutex;
use crate::auth::{verify_password, hash_password};

#[derive(Serialize, Clone)]
pub struct HistoryEntry {
    pub id: i32,
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
            )",
        )?;
        Ok(Database {
            conn: Mutex::new(conn),
        })
    }

    pub fn add_entry(
        &self,
        action_type: &str,
        command: &str,
        success: bool,
        error: Option<String>,
    ) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        let now = Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO history (action_type, command, success, error, timestamp) 
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![action_type, command, success, error, now],
        )?;

        Ok(())
    }

    pub fn get_history(&self, limit: usize) -> SqlResult<Vec<HistoryEntry>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, action_type, command, success, error, timestamp 
             FROM history 
             ORDER BY id DESC 
             LIMIT ?1",
        )?;

        let entries = stmt
            .query_map(params![limit as i32], |row| {
                Ok(HistoryEntry {
                    id: row.get(0)?,
                    action_type: row.get(1)?,
                    command: row.get(2)?,
                    success: row.get::<_, i32>(3)? != 0,
                    error: row.get(4)?,
                    timestamp: row.get(5)?,
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

    // --- Auth related methods --- Argon2 + selt
    pub fn login(&self, username: &str, password: &str) -> SqlResult<Option<String>> {
        let conn = self.conn.lock().unwrap();

        // 1. Récupérer l'utilisateur + hash stocké
        let mut stmt = conn.prepare(
            "SELECT id, password_hash FROM users WHERE username = ?1"
        )?;

        let user: Option<(i32, String)> = stmt
            .query_row(params![username], |row| {
                Ok((row.get(0)?, row.get(1)?))
            })
            .ok();

        // 2. Vérifier mot de passe avec Argon2
        if let Some((user_id, stored_hash)) = user {
            if verify_password(password, &stored_hash) {
                // 3. Générer token si OK
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
        
        // Hash sécurisé Argon2 (avec salt)
        let password_hash = hash_password(password);

        conn.execute(
            "INSERT INTO users (username, password_hash) VALUES (?1, ?2)",
            params![username, password_hash],
        )?;
        Ok(())
    }

    pub fn delete_user(&self, username: &str, password: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        
        // 1. Récupérer l'utilisateur + hash stocké
        let mut stmt = conn.prepare(
            "SELECT id, password_hash FROM users WHERE username = ?1"
        )?;

        let user: Option<(i32, String)> = stmt
            .query_row(params![username], |row| {
                Ok((row.get(0)?, row.get(1)?))
            })
            .ok();

        // 2. Vérifier mot de passe avec Argon2
        if let Some((_user_id, stored_hash)) = user {
            if verify_password(password, &stored_hash) {
                conn.execute(
                    "DELETE FROM users WHERE username = ?1",
                    params![username],
                )?;

                return Ok(());
            }
        }

        Ok(())
    }
}
