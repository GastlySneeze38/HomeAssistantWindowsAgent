// ═══════════════════════════════════════════════════════════════════════════════
// Module RGB — pont vers openrgb-python
//
// Au lieu d'implémenter le protocole binaire OpenRGB SDK en Rust (fragile,
// dépendant de la version), on délègue à l'API Python officielle `openrgb-python`
// via un subprocess. Le script `rgb_bridge.py` retourne du JSON.
//
// Avantages :
//   - openrgb-python est maintenu et testé sur tous les devices
//   - Pas de parsing binaire à la main
//   - Mise à jour triviale si le protocole change (juste `pip upgrade`)
//
// Prérequis : Python + `pip install openrgb-python` sur la machine hôte.
// ═══════════════════════════════════════════════════════════════════════════════

pub mod protocol;

pub use protocol::{RgbDevice, RgbResponse};

use serde::Deserialize;
use std::path::PathBuf;
use tokio::process::Command;

// ── Localisation du script Python ─────────────────────────────────────────────

/// Retourne le chemin absolu de `rgb_bridge.py`, placé à côté de l'exécutable.
/// En développement (`cargo run`), l'exécutable est dans `target/debug/`,
/// on remonte au dossier `Backend/` pour trouver le script.
fn bridge_script() -> PathBuf {
    // Chemin de l'exécutable courant
    let exe = std::env::current_exe().unwrap_or_default();

    // En mode dev : .../target/debug/Backend.exe → on remonte 3 niveaux
    // En mode prod : le script doit être à côté de l'exe
    let candidates = [
        // Production : script à côté de l'exe
        exe.parent().map(|p| p.join("rgb_bridge.py")),
        // Dev (cargo run) : exe dans target/debug/, script dans src/actions/rgb/
        exe.parent().and_then(|p| p.parent()).and_then(|p| p.parent())
            .map(|p| p.join("src/actions/rgb/rgb_bridge.py")),
        // Fallback absolu
        Some(PathBuf::from(r"D:\projets\windows agent\Backend\src\actions\rgb\rgb_bridge.py")),
    ];

    for candidate in &candidates {
        if let Some(path) = candidate {
            if path.exists() {
                return path.clone();
            }
        }
    }

    // Si rien trouvé, on retourne le dernier candidat (l'erreur sera claire)
    PathBuf::from("rgb_bridge.py")
}

// ── Appel du script Python ────────────────────────────────────────────────────

/// Appelle `python rgb_bridge.py <args...>` et retourne la sortie stdout.
/// Les erreurs Python (exit code != 0) sont propagées comme Err(String).
async fn run_bridge(args: &[&str]) -> Result<String, String> {
    let script = bridge_script();

    let output = Command::new("python")
        .arg(&script)
        .args(args)
        .output()
        .await
        .map_err(|e| format!("Impossible de lancer Python : {e}. Python est-il installé ?"))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();

    if !output.status.success() {
        // Le script a retourné exit code != 0.
        // Le JSON d'erreur est dans stdout (convention du bridge).
        return Err(stdout.trim().to_string());
    }

    Ok(stdout)
}

// ── API publique ──────────────────────────────────────────────────────────────

/// Retourne tous les devices RGB détectés par OpenRGB.
pub async fn get_devices() -> Result<Vec<RgbDevice>, String> {
    #[derive(Deserialize)]
    struct PyDevice {
        id: u32,
        name: String,
        led_count: usize,
    }

    let raw = run_bridge(&["get-devices"]).await?;

    // Le bridge peut retourner une erreur JSON même avec exit 0 dans certains cas
    if raw.trim_start().starts_with('{') {
        let err: serde_json::Value = serde_json::from_str(&raw)
            .map_err(|e| format!("JSON invalide du bridge : {e}"))?;
        return Err(err["error"].as_str().unwrap_or("Erreur inconnue").to_string());
    }

    let py_devices: Vec<PyDevice> = serde_json::from_str(&raw)
        .map_err(|e| format!("Impossible de parser la liste de devices : {e}\nRaw: {raw}"))?;

    Ok(py_devices.into_iter().map(|d| RgbDevice {
        id: d.id,
        name: d.name,
        led_count: d.led_count,
    }).collect())
}

/// Applique une couleur RGB. `device_id = None` → tous les devices.
pub async fn set_color(r: u8, g: u8, b: u8, device_id: Option<u32>) -> RgbResponse {
    let r_s = r.to_string();
    let g_s = g.to_string();
    let b_s = b.to_string();
    let id_s;

    let mut args = vec!["set-color", &r_s, &g_s, &b_s];
    if let Some(id) = device_id {
        id_s = id.to_string();
        args.push(&id_s);
    }

    match run_bridge(&args).await {
        Ok(raw) => parse_response(&raw),
        Err(raw) => parse_response(&raw),
    }
}

/// Éteint toutes les LEDs.
pub async fn turn_off(device_id: Option<u32>) -> RgbResponse {
    let id_s;
    let mut args = vec!["turn-off"];
    if let Some(id) = device_id {
        id_s = id.to_string();
        args.push(&id_s);
    }

    match run_bridge(&args).await {
        Ok(raw) => parse_response(&raw),
        Err(raw) => parse_response(&raw),
    }
}

// ── Helper ────────────────────────────────────────────────────────────────────

fn parse_response(raw: &str) -> RgbResponse {
    #[derive(Deserialize)]
    struct PyResponse {
        success: bool,
        error: Option<String>,
    }

    match serde_json::from_str::<PyResponse>(raw) {
        Ok(r) => RgbResponse { success: r.success, error: r.error },
        Err(e) => RgbResponse::err(format!("Réponse bridge invalide : {e}\nRaw: {raw}")),
    }
}
