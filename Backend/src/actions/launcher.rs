use serde::{Deserialize, Serialize};
use std::process::Command;

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

pub fn launch_application(request: LaunchRequest) -> LaunchResponse {

    let result = match request.command.to_lowercase().as_str() {

        // VALORANT
        "valorant" => {
            Command::new(
                "C:\\Riot Games\\Riot Client\\RiotClientServices.exe"
            )
            .args([
                "--launch-product=valorant",
                "--launch-patchline=live"
            ])
            .spawn()
        }

        // NOTEPAD
        "notepad" => {
            Command::new(
                "C:\\Windows\\System32\\notepad.exe"
            )
            .spawn()
        }

        // CALCULATRICE
        "calc" => {
            Command::new(
                "C:\\Windows\\System32\\calc.exe"
            )
            .spawn()
        }

        // APPLICATION INCONNUE
        _ => {
            return LaunchResponse {
                success: false,
                stdout: String::new(),
                stderr: String::new(),
                error: Some(format!(
                    "Application inconnue: {}",
                    request.command
                )),
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
