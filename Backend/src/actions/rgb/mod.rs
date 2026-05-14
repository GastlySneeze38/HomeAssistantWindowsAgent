// ═══════════════════════════════════════════════════════════════════════════════
// Module RGB — API publique
//
// Ce fichier expose uniquement les fonctions appelées par les handlers HTTP.
// Toute la complexité réseau est dans client.rs, le parsing binaire dans parser.rs.
//
// Sous-modules :
//   client.rs   → connexion TCP et commandes OpenRGB (send/recv)
//   parser.rs   → décodage binaire de REQUEST_CONTROLLER_DATA
//   protocol.rs → constantes, types partagés
// ═══════════════════════════════════════════════════════════════════════════════

mod client;
mod parser;
pub mod protocol;

use client::OrgbClient;
pub use protocol::{RgbDevice, RgbResponse};

// ── Fonctions publiques ───────────────────────────────────────────────────────

/// Retourne la liste de tous les contrôleurs RGB détectés par OpenRGB.
pub async fn get_devices() -> Result<Vec<RgbDevice>, String> {
    let mut c = OrgbClient::connect().await?;
    let count = c.get_controller_count().await?;

    eprintln!("[RGB] Récupération de {count} contrôleur(s)...");

    let mut devices = Vec::new();
    for i in 0..count {
        match c.get_controller_info(i).await {
            Ok((name, led_count)) => {
                eprintln!("[RGB] Contrôleur {i} : '{name}' ({led_count} LEDs) ✓");
                devices.push(RgbDevice { id: i, name, led_count });
            }
            Err(e) => {
                // On ne fait pas échouer toute la liste pour un seul contrôleur
                // qui ne parse pas — on log l'erreur et on continue.
                eprintln!(
                    "[RGB] ⚠️  Contrôleur {i} : impossible de parser — {e}. \
                     Ce contrôleur sera retourné avec led_count=0."
                );
                devices.push(RgbDevice {
                    id: i,
                    name: format!("Contrôleur {i} (erreur de parsing)"),
                    led_count: 0,
                });
            }
        }
    }

    eprintln!("[RGB] {}/{count} contrôleur(s) parsé(s) avec succès", devices.iter().filter(|d| d.led_count > 0).count());
    Ok(devices)
}

/// Applique une couleur RGB sur un contrôleur spécifique ou sur tous.
///
/// `device_id = None` → tous les contrôleurs.
/// `device_id = Some(n)` → uniquement le contrôleur n.
pub async fn set_color(r: u8, g: u8, b: u8, device_id: Option<u32>) -> RgbResponse {
    eprintln!(
        "[RGB] set_color R={r} G={g} B={b} device={device_id:?}"
    );
    match apply_color(r, g, b, device_id).await {
        Ok(_) => {
            eprintln!("[RGB] set_color → succès");
            RgbResponse::ok()
        }
        Err(e) => {
            eprintln!("[RGB] set_color → erreur : {e}");
            RgbResponse::err(e)
        }
    }
}

/// Éteint toutes les LEDs (envoie R=0 G=0 B=0).
pub async fn turn_off(device_id: Option<u32>) -> RgbResponse {
    eprintln!("[RGB] turn_off device={device_id:?}");
    set_color(0, 0, 0, device_id).await
}

// ── Logique interne ───────────────────────────────────────────────────────────

async fn apply_color(r: u8, g: u8, b: u8, device_id: Option<u32>) -> Result<(), String> {
    let mut c = OrgbClient::connect().await?;
    let count = c.get_controller_count().await?;

    // Détermine les contrôleurs à cibler
    let targets: Vec<u32> = match device_id {
        None => {
            eprintln!("[RGB] Cible : tous les {count} contrôleur(s)");
            (0..count).collect()
        }
        Some(id) if id < count => {
            eprintln!("[RGB] Cible : contrôleur {id} uniquement");
            vec![id]
        }
        Some(id) => {
            return Err(format!(
                "Contrôleur {id} inexistant (OpenRGB en connaît {count})"
            ));
        }
    };

    for id in targets {
        // On récupère le nombre de LEDs avant d'envoyer les couleurs.
        // Envoyer un mauvais count provoque un comportement indéfini côté OpenRGB.
        let (name, led_count) = c.get_controller_info(id).await?;

        if led_count == 0 {
            eprintln!("[RGB] Contrôleur {id} ('{name}') : 0 LED, skip");
            continue;
        }

        c.update_leds(id, r, g, b, led_count).await?;
        eprintln!("[RGB] Contrôleur {id} ('{name}') : couleur appliquée ✓");
    }

    Ok(())
}
