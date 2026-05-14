// ═══════════════════════════════════════════════════════════════════════════════
// OpenRGB SDK — Constantes du protocole réseau
//
// Source officielle : https://gitlab.com/CalcProgrammer1/OpenRGB
// Fichier de référence dans le dépôt OpenRGB : NetworkProtocol.h
//
// Le protocole OpenRGB tourne sur le port 6742 (correspond à "ORGB" sur un
// clavier téléphonique). Toutes les valeurs sont en little-endian.
// ═══════════════════════════════════════════════════════════════════════════════

use serde::Serialize;
use std::time::Duration;

// ── En-tête de paquet ────────────────────────────────────────────────────────
//
// Chaque paquet commence par 16 octets :
//   [0..4]  magic      = b"ORGB"
//   [4..8]  device_idx = index du contrôleur visé (u32 LE)
//   [8..12] command    = identifiant de commande (u32 LE)
//   [12..16] data_len  = taille du payload qui suit (u32 LE)

pub const MAGIC: &[u8; 4] = b"ORGB";
pub const HEADER_SIZE: usize = 16;

// ── Identifiants de commandes (NET_PACKET_ID_*) ───────────────────────────────
//
// Source : NetworkProtocol.h dans le dépôt OpenRGB officiel.
// ATTENTION : ces valeurs sont fixes et ne doivent pas être modifiées.

/// Demande le nombre de contrôleurs RGB connectés. Réponse : u32.
pub const CMD_REQUEST_CONTROLLER_COUNT: u32 = 0;

/// Demande toutes les infos d'un contrôleur (nom, LEDs, modes, zones).
/// La structure de la réponse dépend de la version de protocole négociée.
pub const CMD_REQUEST_CONTROLLER_DATA: u32 = 1;

/// Négocie la version du protocole.
/// Client envoie : u32 (version max supportée).
/// Serveur répond : u32 (min de nos deux versions) → version effective utilisée.
pub const CMD_REQUEST_PROTOCOL_VERSION: u32 = 40;

/// Identifie le client auprès du serveur (nom affiché dans l'UI OpenRGB).
/// Payload : chaîne UTF-8 terminée par \0.
pub const CMD_SET_CLIENT_NAME: u32 = 50;

/// Met à jour toutes les LEDs d'un contrôleur en une seule commande.
/// ⚠️  VALEUR OFFICIELLE = 1050, pas 1100 (erreur fréquente dans les implémentations tierces).
/// Payload : u32 data_size + u16 color_count + color_count × u32(couleur)
pub const CMD_UPDATE_LEDS: u32 = 1050;

// ── Versions du protocole ─────────────────────────────────────────────────────
//
// Chaque version ajoute des champs dans la réponse REQUEST_CONTROLLER_DATA.
// On utilise v3 car c'est la version la plus répandue (OpenRGB >= 0.7).
//
// v0 → baseline (pas de négociation)
// v1 → ajoute le champ "vendor" dans les contrôleurs
// v2 → ajoute les données de matrice dans les zones (matrix_height/width/map)
// v3 → ajoute brightness_min/max/value dans les modes (si flag HAS_BRIGHTNESS)
// v4 → ajoute les segments dans les zones
// v5 → ajoute les noms alternatifs de LEDs et les flags de contrôleur

/// Version maximale supportée par ce client.
/// Si le serveur supporte moins, il répondra avec sa propre version max.
pub const PROTOCOL_VERSION_REQUESTED: u32 = 3;

// ── Flags des modes (MODE_FLAG_*) ─────────────────────────────────────────────
//
// Ces bits sont dans le champ `flags` (u32) de chaque mode.
// Ils contrôlent quels champs optionnels sont présents dans le binaire.

/// Le mode supporte le réglage de luminosité (affiché dans l'UI OpenRGB).
/// ⚠️  Ce flag N'EST PAS une condition de présence dans le binaire :
/// en v3+, les champs brightness_min/max/value sont TOUJOURS sérialisés,
/// que ce flag soit activé ou non.
#[allow(dead_code)]
pub const MODE_FLAG_HAS_BRIGHTNESS: u32 = 1 << 7; // 0x80

// ── Format des couleurs ───────────────────────────────────────────────────────
//
// OpenRGB encode chaque couleur sur 4 octets : [R, G, B, W]
// où W (white/padding) vaut toujours 0x00.
//
// ⚠️  PIÈGE COURANT : l'ordre est R, G, B — PAS B, G, R.
// En little-endian u32 : 0x00BBGGRR
//   → octet 0 = R (LSB)
//   → octet 1 = G
//   → octet 2 = B
//   → octet 3 = 0x00 (MSB, inutilisé)

/// Encode une couleur RGB en u32 little-endian pour le protocole OpenRGB.
/// Résultat = [R, G, B, 0x00] dans l'ordre mémoire.
pub fn encode_color(r: u8, g: u8, b: u8) -> [u8; 4] {
    [r, g, b, 0x00]
}

// ── Timeouts ──────────────────────────────────────────────────────────────────

/// Délai max pour chaque opération TCP (connexion, lecture, écriture).
/// 3 secondes est suffisant sur loopback (127.0.0.1).
pub const IO_TIMEOUT: Duration = Duration::from_secs(3);

// ── Types publics partagés ────────────────────────────────────────────────────

/// Représentation d'un contrôleur RGB retourné à l'API REST.
#[derive(Serialize, Clone, Debug)]
pub struct RgbDevice {
    pub id: u32,
    pub name: String,
    pub led_count: usize,
}

/// Réponse générique pour les opérations de changement de couleur.
#[derive(Serialize, Debug)]
pub struct RgbResponse {
    pub success: bool,
    pub error: Option<String>,
}

impl RgbResponse {
    pub fn ok() -> Self {
        RgbResponse { success: true, error: None }
    }

    pub fn err(msg: impl Into<String>) -> Self {
        RgbResponse { success: false, error: Some(msg.into()) }
    }
}
