// ═══════════════════════════════════════════════════════════════════════════════
// Module RGB — pont vers openrgb-python
//
// Au lieu d'implémenter le protocole binaire OpenRGB SDK en Rust (fragile,
// dépendant de la version), on délègue à l'API Python officielle `openrgb-python`
// via un subprocess. `rgb_bridge.exe` est un binaire autonome compilé avec
// PyInstaller — aucune installation Python requise sur la machine hôte.
//
// Avantages :
//   - openrgb-python est maintenu et testé sur tous les devices
//   - Pas de parsing binaire à la main
//   - Aucune dépendance Python pour l'utilisateur final
//
// Prérequis : OpenRGB lancé avec le serveur SDK activé (port 6742).
// ═══════════════════════════════════════════════════════════════════════════════

pub mod protocol;

pub use protocol::{RgbDevice, RgbResponse};

use serde::Deserialize;
use std::path::PathBuf;
use tokio::process::Command;

// ── Binaire embarqué ──────────────────────────────────────────────────────────

static BRIDGE_BYTES: &[u8] = include_bytes!("rgb_bridge.exe");

/// Extrait `rgb_bridge.exe` dans le dossier temp système si pas déjà présent,
/// et retourne son chemin. L'extraction est ignorée si le fichier existe déjà
/// avec la bonne taille (évite une écriture disque à chaque appel).
fn bridge_exe() -> PathBuf {
    let path = std::env::temp_dir().join("ha_rgb_bridge.exe");

    let needs_write = match std::fs::metadata(&path) {
        Ok(meta) => meta.len() != BRIDGE_BYTES.len() as u64,
        Err(_) => true,
    };

    if needs_write {
        let _ = std::fs::write(&path, BRIDGE_BYTES);
    }

    path
}

// ── Appel du binaire ──────────────────────────────────────────────────────────

/// Appelle `rgb_bridge.exe <args...>` et retourne la sortie stdout.
async fn run_bridge(args: &[&str]) -> Result<String, String> {
    let bridge = bridge_exe();

    let output = Command::new(&bridge)
        .args(args)
        .output()
        .await
        .map_err(|e| format!("Impossible de lancer rgb_bridge.exe : {e}"))?;

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
