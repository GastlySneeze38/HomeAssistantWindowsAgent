use chrono::Utc;
use rusqlite::{params, Connection, Result as SqlResult};
use serde::Serialize;
use std::sync::Mutex;

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

    pub fn login(&self, username: &str, password_hash: &str) -> SqlResult<Option<String>> {
        let conn = self.conn.lock().unwrap();
        
        // Vérifier si l'utilisateur existe et le mot de passe est correct
        let mut stmt = conn.prepare("SELECT id FROM users WHERE username = ?1 AND password_hash = ?2")?;
        let user_id: Option<i32> = stmt.query_row(
            params![username, password_hash],
            |row| Ok(row.get(0)?),
        ).ok();

        if let Some(user_id) = user_id {
            // Générer un token
            let token = uuid::Uuid::new_v4().to_string();
            let created_at = Utc::now().to_rfc3339();
            let expires_at = (Utc::now() + chrono::Duration::days(7)).to_rfc3339();

            conn.execute(
                "INSERT INTO tokens (token, user_id, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)",
                params![token, user_id, created_at, expires_at],
            )?;

            Ok(Some(token))
        } else {
            Ok(None)
        }
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

    pub fn create_user(&self, username: &str, password_hash: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO users (username, password_hash) VALUES (?1, ?2)",
            params![username, password_hash],
        )?;
        Ok(())
    }
}
