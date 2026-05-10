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
        let conn = Connection::open("history.db")?;
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS history (
                id INTEGER PRIMARY KEY,
                action_type TEXT NOT NULL,
                command TEXT NOT NULL,
                success BOOLEAN NOT NULL,
                error TEXT,
                timestamp TEXT NOT NULL
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
}
