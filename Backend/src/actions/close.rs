use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Deserialize, Clone)]
pub struct CloseRequest {
    pub command: String,
}

#[derive(Serialize, Clone)]
pub struct CloseResponse {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub error: Option<String>,
}

pub fn close_application(request: CloseRequest) -> CloseResponse {
    let input = request.command.trim().to_lowercase();

    // Try alias-based multi-process kill first (e.g. Valorant needs several processes)
    if let Some(processes) = get_process_aliases(&input) {
        let mut any_killed = false;
        for proc in &processes {
            if process_exists(proc) {
                kill_by_name(proc);
                any_killed = true;
            }
        }
        if any_killed {
            return CloseResponse {
                success: true,
                stdout: String::new(),
                stderr: String::new(),
                error: None,
            };
        }
    }

    // Try to find the process name dynamically
    if let Some(proc_name) = find_running_process(&input) {
        return kill_by_name_response(&proc_name);
    }

    // Fallback: kill by window title
    if kill_by_window_title(&input) {
        return CloseResponse {
            success: true,
            stdout: String::new(),
            stderr: String::new(),
            error: None,
        };
    }

    CloseResponse {
        success: false,
        stdout: String::new(),
        stderr: String::new(),
        error: Some(format!("Application non trouvée ou déjà fermée: {}", request.command)),
    }
}

fn kill_by_name(process_name: &str) {
    let _ = Command::new("taskkill")
        .args(["/IM", process_name, "/F", "/T"])
        .output();
}

fn kill_by_name_response(process_name: &str) -> CloseResponse {
    let result = Command::new("taskkill")
        .args(["/IM", process_name, "/F", "/T"])
        .output();

    match result {
        Ok(output) => CloseResponse {
            success: output.status.success(),
            stdout: String::from_utf8_lossy(&output.stdout).to_string(),
            stderr: String::from_utf8_lossy(&output.stderr).to_string(),
            error: if output.status.success() {
                None
            } else {
                Some(String::from_utf8_lossy(&output.stderr).to_string())
            },
        },
        Err(err) => CloseResponse {
            success: false,
            stdout: String::new(),
            stderr: String::new(),
            error: Some(err.to_string()),
        },
    }
}

fn kill_by_window_title(input: &str) -> bool {
    let filter = format!("WINDOWTITLE eq *{}*", input);
    let output = Command::new("taskkill")
        .args(["/FI", &filter, "/F", "/T"])
        .output();

    match output {
        Ok(o) => {
            let stdout = String::from_utf8_lossy(&o.stdout).to_lowercase();
            stdout.contains("success") || stdout.contains("terminé")
        }
        Err(_) => false,
    }
}

fn process_exists(process_name: &str) -> bool {
    let output = match Command::new("tasklist")
        .args(["/FI", &format!("IMAGENAME eq {}", process_name), "/NH", "/FO", "CSV"])
        .output()
    {
        Ok(out) => out,
        Err(_) => return false,
    };

    let task_list = String::from_utf8_lossy(&output.stdout);
    task_list.to_lowercase().contains(&process_name.to_lowercase())
}

/// Returns all process names to kill for well-known apps.
/// Ordered: kill the launcher/client first to prevent restart.
fn get_process_aliases(input: &str) -> Option<Vec<String>> {
    let aliases: &[(&str, &[&str])] = &[
        ("valorant", &["VALORANT-Win64-Shipping.exe", "RiotClientServices.exe", "RiotClientCrashHandler.exe"]),
        ("riot", &["RiotClientServices.exe", "RiotClientCrashHandler.exe"]),
        ("riotclient", &["RiotClientServices.exe", "RiotClientCrashHandler.exe"]),
        ("league", &["League of Legends.exe", "LeagueClientUx.exe", "LeagueClient.exe", "RiotClientServices.exe"]),
        ("leagueoflegends", &["League of Legends.exe", "LeagueClientUx.exe", "LeagueClient.exe"]),
        ("notepad", &["notepad.exe"]),
        ("calc", &["calc.exe", "Calculator.exe"]),
        ("calculator", &["calc.exe", "Calculator.exe"]),
        ("chrome", &["chrome.exe"]),
        ("firefox", &["firefox.exe"]),
        ("discord", &["Discord.exe"]),
        ("spotify", &["Spotify.exe"]),
        ("steam", &["steam.exe", "steamwebhelper.exe"]),
        ("vlc", &["vlc.exe"]),
        ("explorer", &["explorer.exe"]),
        ("word", &["WINWORD.EXE"]),
        ("excel", &["EXCEL.EXE"]),
        ("powerpoint", &["POWERPNT.EXE"]),
        ("teams", &["Teams.exe"]),
        ("obs", &["obs64.exe", "obs32.exe"]),
    ];

    for (alias, processes) in aliases {
        if input.contains(alias) {
            return Some(processes.iter().map(|s| s.to_string()).collect());
        }
    }

    None
}

/// Scan running processes for a partial name match.
fn find_running_process(input: &str) -> Option<String> {
    // Try exact .exe variants first
    let candidates = [
        input.to_string(),
        format!("{}.exe", input),
        format!("{}{}", &input[..1].to_uppercase(), &input[1..]),
        format!("{}{}.exe", &input[..1].to_uppercase(), &input[1..]),
    ];

    for candidate in &candidates {
        if process_exists(candidate) {
            return Some(candidate.clone());
        }
    }

    // Full tasklist scan for partial match
    let output = Command::new("tasklist")
        .args(["/NH", "/FO", "CSV"])
        .output()
        .ok()?;

    let task_list = String::from_utf8_lossy(&output.stdout);

    for line in task_list.lines() {
        let line_lower = line.to_lowercase();
        if line_lower.contains(input) {
            // CSV format: "process.exe","PID",...
            if let Some(name) = line.split('"').nth(1) {
                return Some(name.to_string());
            }
        }
    }

    None
}
