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
    let process_name = match find_process_name(&request.command) {
        Some(name) => name,
        None => {
            return CloseResponse {
                success: false,
                stdout: String::new(),
                stderr: String::new(),
                error: Some(format!("Application non trouvée: {}", request.command)),
            }
        }
    };

    // Vérifier que le processus existe vraiment avant de le tuer
    if !process_exists(&process_name) {
        return CloseResponse {
            success: false,
            stdout: String::new(),
            stderr: String::new(),
            error: Some(format!(
                "Le processus '{}' n'est pas en cours d'exécution",
                process_name
            )),
        };
    }

    let result = Command::new("taskkill")
        .args(["/IM", &process_name, "/F"])
        .output();

    match result {
        Ok(output) => CloseResponse {
            success: output.status.success(),
            stdout: String::from_utf8_lossy(&output.stdout).to_string(),
            stderr: String::from_utf8_lossy(&output.stderr).to_string(),
            error: if output.status.success() { None } else { Some(String::from_utf8_lossy(&output.stderr).to_string()) },
        },
        Err(err) => CloseResponse {
            success: false,
            stdout: String::new(),
            stderr: String::new(),
            error: Some(err.to_string()),
        },
    }
}

fn process_exists(process_name: &str) -> bool {
    let output = match Command::new("tasklist")
        .args(["/FI", &format!("IMAGENAME eq {}", process_name)])
        .output()
    {
        Ok(out) => out,
        Err(_) => return false,
    };

    let task_list = String::from_utf8_lossy(&output.stdout);
    task_list.to_lowercase().contains(&process_name.to_lowercase())
}

fn find_process_name(input: &str) -> Option<String> {
    let lower_input = input.to_lowercase().trim().to_string();

    // Étape 1: Vérifier les alias connus
    if let Some(mapped) = get_process_alias(&lower_input) {
        if process_exists(&mapped) {
            return Some(mapped);
        }
    }

    // Étape 2: Si l'input contient déjà .exe, l'utiliser directement
    if lower_input.ends_with(".exe") {
        if process_exists(&lower_input) {
            return Some(lower_input);
        }
    }

    // Étape 3: Essayer de chercher dans les processus actuels
    if let Some(found) = search_running_process(&lower_input) {
        return Some(found);
    }

    // Étape 4: Ajouter .exe et vérifier
    let with_exe = format!("{}.exe", lower_input);
    if process_exists(&with_exe) {
        return Some(with_exe);
    }

    // Étape 5: Essayer avec majuscule initiale + .exe
    let capitalized = format!("{}.exe", lower_input.chars().next().unwrap().to_uppercase().to_string() + &lower_input[1..]);
    if process_exists(&capitalized) {
        return Some(capitalized);
    }

    None
}

fn get_process_alias(input: &str) -> Option<String> {
    let aliases = vec![
        ("valorant", vec!["RiotClientServices.exe"]),
        ("riot", vec!["RiotClientServices.exe"]),
        ("riotclient", vec!["RiotClientServices.exe"]),
        ("notepad", vec!["notepad.exe"]),
        ("note", vec!["notepad.exe"]),
        ("calc", vec!["calc.exe", "Calculator.exe"]),
        ("calculator", vec!["calc.exe", "Calculator.exe"]),
    ];

    for (alias, processes) in aliases {
        if input.contains(alias) {
            // Retourner le premier processus qui existe réellement
            for process in &processes {
                if process_exists(process) {
                    return Some(process.to_string());
                }
            }
            // Si aucun n'existe, retourner le premier de la liste
            return Some(processes[0].to_string());
        }
    }

    None
}

fn search_running_process(input: &str) -> Option<String> {
    let output = Command::new("tasklist")
        .output()
        .ok()?;

    let task_list = String::from_utf8_lossy(&output.stdout);

    for line in task_list.lines() {
        let line_lower = line.to_lowercase();
        if line_lower.contains(input) {
            // Extraire le nom du processus (première colonne)
            if let Some(process_name) = line.split_whitespace().next() {
                return Some(process_name.to_string());
            }
        }
    }

    None
}
