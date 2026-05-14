use serde::{Deserialize, Serialize};
use std::process::Command;
use crate::core::database::{AppEntry, Database};

#[derive(Deserialize, Clone)]
pub struct LaunchRequest {
    pub command: String,
}

#[derive(Serialize, Clone)]
pub struct LaunchResponse {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub error: Option<String>,
}

pub fn launch_application(request: LaunchRequest, db: &Database) -> LaunchResponse {
    let name = request.command.trim().to_lowercase();

    // 1. Lookup in database
    if let Ok(Some(app)) = db.get_app_by_name(&name) {
        return spawn_app(&app);
    }

    // 2. Built-in aliases as fallback
    let result = match name.as_str() {
        "valorant" => Command::new("C:\\Riot Games\\Riot Client\\RiotClientServices.exe")
            .args(["--launch-product=valorant", "--launch-patchline=live"])
            .spawn(),
        "notepad" => Command::new("C:\\Windows\\System32\\notepad.exe").spawn(),
        "calc" | "calculator" => Command::new("C:\\Windows\\System32\\calc.exe").spawn(),
        _ => {
            return LaunchResponse {
                success: false,
                stdout: String::new(),
                stderr: String::new(),
                error: Some(format!("Application inconnue: {}", request.command)),
            };
        }
    };

    match result {
        Ok(_) => LaunchResponse {
            success: true,
            stdout: String::new(),
            stderr: String::new(),
            error: None,
        },
        Err(err) => LaunchResponse {
            success: false,
            stdout: String::new(),
            stderr: String::new(),
            error: Some(err.to_string()),
        },
    }
}

fn spawn_app(app: &AppEntry) -> LaunchResponse {
    let mut cmd = Command::new(&app.path);
    if let Some(args) = &app.args {
        if !args.trim().is_empty() {
            // Split args respecting quoted strings
            let parsed: Vec<&str> = args.split_whitespace().collect();
            cmd.args(&parsed);
        }
    }
    match cmd.spawn() {
        Ok(_) => LaunchResponse {
            success: true,
            stdout: String::new(),
            stderr: String::new(),
            error: None,
        },
        Err(err) => LaunchResponse {
            success: false,
            stdout: String::new(),
            stderr: String::new(),
            error: Some(err.to_string()),
        },
    }
}
