use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Deserialize)]
pub struct LaunchRequest {
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
}

#[derive(Serialize)]
pub struct LaunchResponse {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub error: Option<String>,
}

pub fn launch_application(request: LaunchRequest) -> LaunchResponse {
    match Command::new(&request.command).args(&request.args).output() {
        Ok(output) => LaunchResponse {
            success: output.status.success(),
            stdout: String::from_utf8_lossy(&output.stdout).to_string(),
            stderr: String::from_utf8_lossy(&output.stderr).to_string(),
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
