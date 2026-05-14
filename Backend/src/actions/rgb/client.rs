// ═══════════════════════════════════════════════════════════════════════════════
// Client TCP pour le SDK OpenRGB
//
// Gère la connexion, la négociation de protocole et les commandes réseau.
// Toutes les opérations sont async (Tokio) avec timeout sur chaque I/O.
//
// Cycle de vie d'une connexion :
//   1. connect() → TCP sur 127.0.0.1:6742
//   2. SET_CLIENT_NAME → on s'identifie dans l'UI OpenRGB
//   3. REQUEST_PROTOCOL_VERSION → on négocie la version
//   4. Commandes métier (get_controller_count, get_controller_info, update_leds)
//   5. Drop → la connexion TCP se ferme automatiquement
//
// Une instance = une connexion. On ne réutilise pas les connexions entre
// requêtes HTTP car OpenRGB est monothread côté serveur (pas de multiplexage).
// ═══════════════════════════════════════════════════════════════════════════════

use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::time::timeout;

use crate::actions::rgb::parser::parse_controller_data;
use crate::actions::rgb::protocol::{
    encode_color, CMD_REQUEST_CONTROLLER_COUNT, CMD_REQUEST_CONTROLLER_DATA,
    CMD_REQUEST_PROTOCOL_VERSION, CMD_SET_CLIENT_NAME, CMD_UPDATE_LEDS, HEADER_SIZE,
    IO_TIMEOUT, MAGIC, PROTOCOL_VERSION_REQUESTED,
};

// ── Structure principale ──────────────────────────────────────────────────────

pub struct OrgbClient {
    stream: TcpStream,
    /// Version de protocole effectivement négociée avec le serveur.
    /// C'est le min(PROTOCOL_VERSION_REQUESTED, version_serveur).
    pub negotiated_version: u32,
}

// ── Connexion et handshake ────────────────────────────────────────────────────

impl OrgbClient {
    /// Crée une nouvelle connexion à OpenRGB et effectue le handshake complet :
    ///   1. Connexion TCP à 127.0.0.1:6742
    ///   2. Envoi du nom du client (visible dans l'UI OpenRGB)
    ///   3. Négociation de la version du protocole
    ///
    /// Retourne une erreur explicite si OpenRGB n'est pas lancé.
    pub async fn connect() -> Result<Self, String> {
        eprintln!("[RGB][client] Connexion à OpenRGB sur 127.0.0.1:6742...");

        let stream = timeout(IO_TIMEOUT, TcpStream::connect("127.0.0.1:6742"))
            .await
            .map_err(|_| {
                "OpenRGB : timeout de connexion (3s). \
                 OpenRGB est-il lancé avec le SDK activé ?"
                    .to_string()
            })?
            .map_err(|e| {
                format!(
                    "OpenRGB : impossible de se connecter au port 6742 — {e}. \
                     Vérifiez que OpenRGB est démarré et que le SDK réseau est activé \
                     (Settings → SDK Server → Start Server)."
                )
            })?;

        eprintln!("[RGB][client] Connexion TCP établie");

        let mut client = OrgbClient { stream, negotiated_version: 0 };

        // ── Étape 1 : identification du client ───────────────────────────────
        // Le nom est visible dans l'onglet SDK d'OpenRGB. Pas de réponse attendue.
        client
            .send_packet(0, CMD_SET_CLIENT_NAME, b"HomeAssistantWindowsAgent\0")
            .await?;

        eprintln!("[RGB][client] Nom du client envoyé");

        // ── Étape 2 : négociation de version ─────────────────────────────────
        // On envoie notre version max. Le serveur répond avec min(notre_v, sa_v).
        // Cette version négociée détermine les champs présents dans les réponses.
        client
            .send_packet(
                0,
                CMD_REQUEST_PROTOCOL_VERSION,
                &PROTOCOL_VERSION_REQUESTED.to_le_bytes(),
            )
            .await?;

        let (_, _, ver_data) = client.recv_packet().await?;
        let negotiated = if ver_data.len() >= 4 {
            u32::from_le_bytes(ver_data[0..4].try_into().unwrap())
        } else {
            // Serveur très ancien (v0) qui ne répond pas à la négociation
            eprintln!(
                "[RGB][client] ⚠️  Réponse de négociation trop courte ({} octets) \
                 → on suppose v0",
                ver_data.len()
            );
            0
        };

        client.negotiated_version = negotiated;
        eprintln!(
            "[RGB][client] Protocole négocié : v{negotiated} \
             (on avait demandé v{PROTOCOL_VERSION_REQUESTED})"
        );

        Ok(client)
    }
}

// ── Commandes métier ──────────────────────────────────────────────────────────

impl OrgbClient {
    /// Retourne le nombre total de contrôleurs RGB détectés par OpenRGB.
    pub async fn get_controller_count(&mut self) -> Result<u32, String> {
        self.send_packet(0, CMD_REQUEST_CONTROLLER_COUNT, &[]).await?;
        let (_, _, data) = self.recv_packet().await?;

        if data.len() < 4 {
            return Err(format!(
                "get_controller_count : réponse trop courte ({} octets, besoin de 4)",
                data.len()
            ));
        }
        let count = u32::from_le_bytes(data[0..4].try_into().unwrap());
        eprintln!("[RGB][client] {count} contrôleur(s) détecté(s)");
        Ok(count)
    }

    /// Retourne le nom et le nombre de LEDs d'un contrôleur.
    ///
    /// Le parsing dépend de `self.negotiated_version` — c'est pour ça qu'on
    /// stocke la version dans le client plutôt que de la passer partout.
    pub async fn get_controller_info(&mut self, idx: u32) -> Result<(String, usize), String> {
        self.send_packet(idx, CMD_REQUEST_CONTROLLER_DATA, &[]).await?;
        let (_, _, data) = self.recv_packet().await?;

        eprintln!(
            "[RGB][client] Contrôleur {idx} : payload reçu ({} octets), \
             parsing avec protocole v{}...",
            data.len(),
            self.negotiated_version
        );

        parse_controller_data(&data, self.negotiated_version)
    }

    /// Envoie une couleur uniforme sur toutes les LEDs d'un contrôleur.
    ///
    /// Format du payload CMD_UPDATE_LEDS (source : NetworkProtocol.cpp) :
    ///   u32 data_size   = 2 + (led_count × 4)
    ///   u16 color_count = led_count
    ///   × u32 color     = [R, G, B, 0x00] en little-endian
    ///
    /// ⚠️  ORDRE DES OCTETS : R, G, B — pas B, G, R.
    /// ⚠️  COMMANDE : 1050, pas 1100.
    pub async fn update_leds(
        &mut self,
        device_idx: u32,
        r: u8,
        g: u8,
        b: u8,
        led_count: usize,
    ) -> Result<(), String> {
        if led_count == 0 {
            eprintln!("[RGB][client] Contrôleur {device_idx} : 0 LED, skip");
            return Ok(());
        }

        let color = encode_color(r, g, b);
        let color_count = led_count as u16;

        // data_size = taille des données APRÈS ce u32
        //           = 2 (color_count u16) + led_count × 4 (couleurs u32)
        let data_size = (2 + led_count * 4) as u32;

        let mut payload = Vec::with_capacity(4 + 2 + led_count * 4);
        payload.extend_from_slice(&data_size.to_le_bytes());
        payload.extend_from_slice(&color_count.to_le_bytes());
        for _ in 0..led_count {
            payload.extend_from_slice(&color);
        }

        eprintln!(
            "[RGB][client] Contrôleur {device_idx} : envoi couleur \
             R={r} G={g} B={b} sur {led_count} LED(s) \
             (payload = {} octets, cmd={})",
            payload.len(),
            CMD_UPDATE_LEDS
        );

        self.send_packet(device_idx, CMD_UPDATE_LEDS, &payload).await
    }
}

// ── Couche transport TCP ──────────────────────────────────────────────────────

impl OrgbClient {
    /// Envoie un paquet OpenRGB.
    ///
    /// Structure de l'en-tête (16 octets) :
    ///   [0..4]   magic      = b"ORGB"
    ///   [4..8]   device_idx (u32 LE)
    ///   [8..12]  command    (u32 LE)
    ///   [12..16] data_len   (u32 LE) = len(payload)
    ///   [16..]   payload
    async fn send_packet(&mut self, device_idx: u32, cmd: u32, payload: &[u8]) -> Result<(), String> {
        let mut buf = Vec::with_capacity(HEADER_SIZE + payload.len());
        buf.extend_from_slice(MAGIC);
        buf.extend_from_slice(&device_idx.to_le_bytes());
        buf.extend_from_slice(&cmd.to_le_bytes());
        buf.extend_from_slice(&(payload.len() as u32).to_le_bytes());
        buf.extend_from_slice(payload);

        timeout(IO_TIMEOUT, self.stream.write_all(&buf))
            .await
            .map_err(|_| format!("OpenRGB : timeout d'écriture (cmd={cmd})"))?
            .map_err(|e| format!("OpenRGB : erreur d'écriture (cmd={cmd}) — {e}"))
    }

    /// Reçoit un paquet OpenRGB et retourne (device_idx, command, payload).
    ///
    /// On vérifie le magic pour détecter immédiatement les désynchronisations.
    /// Si le magic est mauvais, ça signifie qu'un paquet précédent a été mal lu.
    async fn recv_packet(&mut self) -> Result<(u32, u32, Vec<u8>), String> {
        // ── Lecture de l'en-tête 16 octets ───────────────────────────────────
        let mut hdr = [0u8; HEADER_SIZE];
        timeout(IO_TIMEOUT, self.stream.read_exact(&mut hdr))
            .await
            .map_err(|_| "OpenRGB : timeout de lecture de l'en-tête".to_string())?
            .map_err(|e| format!("OpenRGB : erreur de lecture de l'en-tête — {e}"))?;

        // Vérification du magic — si mauvais, on est désynchronisé
        if &hdr[0..4] != MAGIC {
            return Err(format!(
                "OpenRGB : magic invalide reçu : {:02x?} (attendu {:02x?}). \
                 Désynchronisation du flux TCP — connexion corrompue.",
                &hdr[0..4], MAGIC
            ));
        }

        let device_idx = u32::from_le_bytes(hdr[4..8].try_into().unwrap());
        let command = u32::from_le_bytes(hdr[8..12].try_into().unwrap());
        let data_len = u32::from_le_bytes(hdr[12..16].try_into().unwrap()) as usize;

        // ── Lecture du payload ────────────────────────────────────────────────
        let mut data = vec![0u8; data_len];
        if data_len > 0 {
            timeout(IO_TIMEOUT, self.stream.read_exact(&mut data))
                .await
                .map_err(|_| {
                    format!(
                        "OpenRGB : timeout de lecture du payload \
                         (cmd={command}, attendu {data_len} octets)"
                    )
                })?
                .map_err(|e| {
                    format!(
                        "OpenRGB : erreur de lecture du payload \
                         (cmd={command}, attendu {data_len} octets) — {e}"
                    )
                })?;
        }

        Ok((device_idx, command, data))
    }
}
