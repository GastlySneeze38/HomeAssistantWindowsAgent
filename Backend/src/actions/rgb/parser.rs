// ═══════════════════════════════════════════════════════════════════════════════
// Parseur de la réponse REQUEST_CONTROLLER_DATA (commande 1)
//
// C'est la partie la plus délicate du protocole : la structure binaire change
// selon la version négociée, et le moindre désalignement fait planter tout
// le reste (on lit des octets au mauvais endroit → garbage).
//
// Structure générale de la réponse (dans l'ordre des octets) :
//
//   u32  data_size        — taille totale du bloc qui suit (ignoré, on lit tout)
//   u32  device_type      — enum du type de périphérique (ignoré ici)
//   str  name             — u16 longueur (null inclus) + octets
//   str  vendor           — idem  (présent à partir de v1)
//   str  description      — idem
//   str  version          — idem
//   str  serial           — idem
//   str  location         — idem
//   u16  num_modes
//     × mode :
//       str  name
//       i32  value
//       u32  flags
//       u32  speed_min
//       u32  speed_max
//       [v3+, si flag HAS_BRIGHTNESS] u32 brightness_min, u32 brightness_max, u32 brightness
//       u32  colors_min
//       u32  colors_max
//       u32  speed
//       u32  direction
//       u32  color_mode
//       u16  num_colors
//       × u32 colors
//   u16  num_zones
//     × zone :
//       str  name
//       u32  type
//       u32  leds_min, leds_max, leds_count
//       [v2+] u16 matrix_height, u16 matrix_width, u16 entry_count
//       [v2+] entry_count × u32  (map LED index → position)
//   u16  num_leds   ← CE QU'ON CHERCHE
//     × led :
//       str  name
//       u32  value
//   u16  num_colors
//   × u32 colors
//   u32  active_mode
//
// Source : NetworkProtocol.cpp dans le dépôt OpenRGB officiel
//          https://gitlab.com/CalcProgrammer1/OpenRGB
// ═══════════════════════════════════════════════════════════════════════════════

use crate::actions::rgb::protocol::MODE_FLAG_HAS_BRIGHTNESS;

// ── Point d'entrée public ─────────────────────────────────────────────────────

/// Extrait le nom du contrôleur et le nombre de LEDs depuis le payload binaire
/// de la réponse REQUEST_CONTROLLER_DATA.
///
/// `protocol_version` est la version **négociée** (réponse du serveur),
/// pas la version qu'on a demandée. Elle détermine quels champs optionnels
/// sont présents dans le binaire.
pub fn parse_controller_data(
    data: &[u8],
    protocol_version: u32,
) -> Result<(String, usize), String> {
    let mut c = Cursor::new(data);
    parse_inner(&mut c, protocol_version)
        .map_err(|e| format!("parse error at byte {}: {}", c.pos, e))
}

fn parse_inner(c: &mut Cursor, protocol_version: u32) -> Result<(String, usize), String> {
    // ── En-tête du contrôleur ─────────────────────────────────────────────────

    c.skip_u32("data_size")?;    // taille totale, on l'ignore
    c.skip_u32("device_type")?;  // type enum, inutile ici

    let name = c.read_str("name")?;
    eprintln!("[RGB][parser] Contrôleur : '{name}' (pos après nom = {})", c.pos);

    // vendor est ajouté en v1 — tous nos serveurs cibles sont >= v1
    if protocol_version >= 1 {
        c.read_str("vendor")?;
    }

    c.read_str("description")?;
    c.read_str("version")?;
    c.read_str("serial")?;
    c.read_str("location")?;

    eprintln!("[RGB][parser] '{name}' — strings lues, pos = {}", c.pos);

    // ── Modes ─────────────────────────────────────────────────────────────────

    let num_modes = c.read_u16("num_modes")? as usize;
    eprintln!("[RGB][parser] '{name}' — {num_modes} modes");

    for i in 0..num_modes {
        skip_mode(c, &name, i, protocol_version)?;
    }

    eprintln!("[RGB][parser] '{name}' — modes traités, pos = {}", c.pos);

    // ── Zones ─────────────────────────────────────────────────────────────────

    let num_zones = c.read_u16("num_zones")? as usize;
    eprintln!("[RGB][parser] '{name}' — {num_zones} zones");

    for i in 0..num_zones {
        skip_zone(c, &name, i, protocol_version)?;
    }

    eprintln!("[RGB][parser] '{name}' — zones traitées, pos = {}", c.pos);

    // ── LEDs — le compte qu'on cherche ───────────────────────────────────────

    let num_leds = c.read_u16("num_leds")? as usize;
    eprintln!("[RGB][parser] '{name}' — {num_leds} LEDs ✓");

    Ok((name, num_leds))
}

// ── Saut d'un mode ────────────────────────────────────────────────────────────

fn skip_mode(
    c: &mut Cursor,
    device_name: &str,
    mode_index: usize,
    protocol_version: u32,
) -> Result<(), String> {
    let mode_start = c.pos;

    let mode_name = c.read_str("mode.name")?;
    c.skip_i32("mode.value")?;

    // Les flags déterminent les champs optionnels de brightness (v3+)
    let flags = c.read_u32("mode.flags")?;

    c.skip_u32("mode.speed_min")?;
    c.skip_u32("mode.speed_max")?;

    // ⚠️  CHAMP CONDITIONNEL : brightness présent SEULEMENT si :
    //   - protocole négocié >= 3
    //   - ET le bit HAS_BRIGHTNESS (0x80) est activé dans flags
    // Si on lit ces octets sans vérifier le flag, tout le reste est décalé.
    if protocol_version >= 3 && (flags & MODE_FLAG_HAS_BRIGHTNESS != 0) {
        c.skip_u32("mode.brightness_min")?;
        c.skip_u32("mode.brightness_max")?;
        c.skip_u32("mode.brightness")?;
        eprintln!(
            "[RGB][parser] '{device_name}' mode[{mode_index}]='{mode_name}' \
             a HAS_BRIGHTNESS → 3 u32 supplémentaires lus"
        );
    }

    c.skip_u32("mode.colors_min")?;
    c.skip_u32("mode.colors_max")?;
    c.skip_u32("mode.speed")?;
    c.skip_u32("mode.direction")?;
    c.skip_u32("mode.color_mode")?;

    let num_colors = c.read_u16("mode.num_colors")? as usize;
    c.skip_n(num_colors * 4, "mode.colors")?; // num_colors × u32

    eprintln!(
        "[RGB][parser] '{device_name}' mode[{mode_index}]='{mode_name}' \
         flags=0x{flags:08x} colors={num_colors} (octet début={mode_start} fin={})",
        c.pos
    );

    Ok(())
}

// ── Saut d'une zone ───────────────────────────────────────────────────────────

fn skip_zone(
    c: &mut Cursor,
    device_name: &str,
    zone_index: usize,
    protocol_version: u32,
) -> Result<(), String> {
    let zone_start = c.pos;

    let zone_name = c.read_str("zone.name")?;
    c.skip_u32("zone.type")?;
    c.skip_u32("zone.leds_min")?;
    c.skip_u32("zone.leds_max")?;
    c.skip_u32("zone.leds_count")?;

    // ⚠️  CHAMP CONDITIONNEL : données de matrice présentes à partir de v2.
    // entry_count est le nombre d'entrées de la map (height × width).
    // Chaque entrée est un u32 (index LED ou 0xFFFFFFFF si vide).
    // ERREUR COMMUNE : sauter entry_count octets au lieu de entry_count × 4 !
    let entry_count = if protocol_version >= 2 {
        let matrix_height = c.read_u16("zone.matrix_height")?;
        let matrix_width = c.read_u16("zone.matrix_width")?;
        let entry_count = c.read_u16("zone.matrix_entry_count")? as usize;

        eprintln!(
            "[RGB][parser] '{device_name}' zone[{zone_index}]='{zone_name}' \
             matrice {matrix_height}×{matrix_width} → {entry_count} entrées"
        );

        entry_count
    } else {
        0
    };

    // Chaque entrée = 1 u32 (4 octets), pas 1 octet !
    c.skip_n(entry_count * 4, "zone.matrix_data")?;

    eprintln!(
        "[RGB][parser] '{device_name}' zone[{zone_index}]='{zone_name}' \
         (octet début={zone_start} fin={})",
        c.pos
    );

    Ok(())
}

// ═══════════════════════════════════════════════════════════════════════════════
// Cursor — lecture séquentielle d'un slice d'octets
// ═══════════════════════════════════════════════════════════════════════════════

pub struct Cursor<'a> {
    pub data: &'a [u8],
    pub pos: usize,
}

impl<'a> Cursor<'a> {
    pub fn new(data: &'a [u8]) -> Self {
        Cursor { data, pos: 0 }
    }

    /// Vérifie qu'on peut encore lire `n` octets. Donne un message d'erreur clair.
    fn require(&self, n: usize, field: &str) -> Result<(), String> {
        if self.pos + n > self.data.len() {
            Err(format!(
                "champ '{field}' : besoin de {n} octet(s) à pos {}, \
                 mais il n'en reste que {} (total = {})",
                self.pos,
                self.data.len().saturating_sub(self.pos),
                self.data.len()
            ))
        } else {
            Ok(())
        }
    }

    pub fn read_u16(&mut self, field: &str) -> Result<u16, String> {
        self.require(2, field)?;
        let v = u16::from_le_bytes(self.data[self.pos..self.pos + 2].try_into().unwrap());
        self.pos += 2;
        Ok(v)
    }

    pub fn read_u32(&mut self, field: &str) -> Result<u32, String> {
        self.require(4, field)?;
        let v = u32::from_le_bytes(self.data[self.pos..self.pos + 4].try_into().unwrap());
        self.pos += 4;
        Ok(v)
    }

    pub fn skip_i32(&mut self, field: &str) -> Result<(), String> {
        self.require(4, field)?;
        self.pos += 4;
        Ok(())
    }

    pub fn skip_u32(&mut self, field: &str) -> Result<(), String> {
        self.require(4, field)?;
        self.pos += 4;
        Ok(())
    }

    /// Saute exactement `n` octets (pour les tableaux de taille variable).
    pub fn skip_n(&mut self, n: usize, field: &str) -> Result<(), String> {
        self.require(n, field)?;
        self.pos += n;
        Ok(())
    }

    /// Lit une chaîne length-prefixed : u16 longueur (null inclus) + octets.
    /// Retourne la chaîne sans le null-terminator final.
    pub fn read_str(&mut self, field: &str) -> Result<String, String> {
        let len = self.read_u16(&format!("{field}.len"))? as usize;
        if len == 0 {
            return Ok(String::new());
        }
        self.require(len, field)?;
        let bytes = &self.data[self.pos..self.pos + len];
        self.pos += len;
        // Le dernier octet est le null-terminator, on l'exclut
        let text = &bytes[..len.saturating_sub(1)];
        Ok(String::from_utf8_lossy(text).to_string())
    }
}
