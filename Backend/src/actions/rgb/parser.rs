// ═══════════════════════════════════════════════════════════════════════════════
// Parseur de la réponse REQUEST_CONTROLLER_DATA (commande 1)
//
// Structure complète du payload (dans l'ordre des octets) :
//
//   u32  data_size        — taille totale du bloc (ignorée, on lit tout)
//   u32  device_type      — enum de type (ignoré)
//   str  name             — u16 longueur (null inclus) + octets
//   str  vendor           — idem (v1+)
//   str  description      — idem
//   str  version          — idem
//   str  serial           — idem
//   str  location         — idem
//   u16  num_modes
//   i32  active_mode      ← CHAMP SOUVENT OUBLIÉ : index du mode actif
//     × mode :
//       str  name
//       i32  value
//       u32  flags
//       u32  speed_min
//       u32  speed_max
//       [v3+] u32 brightness_min, u32 brightness_max, u32 brightness
//             ↑ TOUJOURS présent en v3+, PAS conditionnel au flag HAS_BRIGHTNESS
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
//       [v2+] entry_count × u32  (map LED→position, 0xFFFFFFFF=vide)
//       [v4+] u16 num_segments
//             × segment : str name, u32 type, u32 start, u32 leds_count
//       [v5+] u32 zone_flags
//   u16  num_leds   ← CE QU'ON CHERCHE
//     × led : str name, u32 value
//   u16  num_colors
//   × u32 colors
//   [v5+] u16 num_led_alt_names
//         × led_alt : u32 led_index, str alt_name
//         u32 controller_flags
//
// Sources vérifiées :
//   - NetworkProtocol.cpp (OpenRGB GitLab officiel)
//   - openrgb-python/utils.py (bibliothèque Python officielle, parsing vérifié)
//   - go-openrgb/protocol.md (documentation de référence)
// ═══════════════════════════════════════════════════════════════════════════════

// ── Point d'entrée public ─────────────────────────────────────────────────────

/// Extrait le nom du contrôleur et le nombre de LEDs depuis le payload binaire.
///
/// `protocol_version` est la version que le SERVEUR a déclaré utiliser.
/// C'est elle qui détermine quels champs optionnels sont présents.
pub fn parse_controller_data(
    data: &[u8],
    protocol_version: u32,
) -> Result<(String, usize), String> {
    let mut c = Cursor::new(data);
    parse_inner(&mut c, protocol_version).map_err(|e| {
        // On inclut la position courante dans le message d'erreur pour faciliter le debug
        format!("parse error at byte {}: {}", c.pos, e)
    })
}

fn parse_inner(c: &mut Cursor, protocol_version: u32) -> Result<(String, usize), String> {
    // ── En-tête du contrôleur ─────────────────────────────────────────────────

    c.skip_u32("data_size")?;   // taille totale, ignorée
    c.skip_u32("device_type")?; // type enum, ignoré

    let name = c.read_str("name")?;
    eprintln!("[RGB][parser] Contrôleur : '{name}' (pos après nom = {})", c.pos);

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

    // ⚠️  active_mode vient IMMÉDIATEMENT après num_modes, avant les données de modes.
    // C'est un i32 (signé) qui contient l'index du mode actuellement actif.
    // Ce champ est TOUJOURS présent, même si num_modes == 0.
    // L'oublier décale tout le reste de 4 octets → garbage dans tous les champs suivants.
    // Confirmé par openrgb-python/utils.py et go-openrgb/protocol.md.
    let active_mode = c.read_i32("active_mode")?;

    eprintln!(
        "[RGB][parser] '{name}' — {num_modes} modes, mode actif = {active_mode}"
    );

    // Hex dump des 16 octets au point de lecture actuel — aide à diagnostiquer
    // les désalignements si les modes se parsent mal.
    let peek_end = (c.pos + 16).min(c.data.len());
    eprintln!(
        "[RGB][parser] '{name}' — octets[{}..{}] avant modes : {:02x?}",
        c.pos, peek_end, &c.data[c.pos..peek_end]
    );

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

    // ── LEDs — le nombre qu'on cherche ───────────────────────────────────────

    let num_leds = c.read_u16("num_leds")? as usize;
    eprintln!("[RGB][parser] '{name}' — {num_leds} LEDs ✓  (pos = {})", c.pos);

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
    let flags = c.read_u32("mode.flags")?;

    c.skip_u32("mode.speed_min")?;
    c.skip_u32("mode.speed_max")?;

    // ⚠️  BRIGHTNESS : présent en v3+ pour TOUS les modes.
    // Ce n'est PAS conditionnel au flag HAS_BRIGHTNESS dans le binaire.
    // HAS_BRIGHTNESS indique si le mode supporte le réglage, mais les 3 champs
    // sont TOUJOURS sérialisés en v3+ quelle que soit la valeur du flag.
    // Source : openrgb-python/utils.py (v3 branch, pas de vérification de flag)
    if protocol_version >= 3 {
        c.skip_u32("mode.brightness_min")?;
        c.skip_u32("mode.brightness_max")?;
        c.skip_u32("mode.brightness")?;
    }

    c.skip_u32("mode.colors_min")?;
    c.skip_u32("mode.colors_max")?;
    c.skip_u32("mode.speed")?;
    c.skip_u32("mode.direction")?;
    c.skip_u32("mode.color_mode")?;

    let num_colors = c.read_u16("mode.num_colors")? as usize;
    c.skip_n(num_colors * 4, "mode.colors")?;

    eprintln!(
        "[RGB][parser] '{device_name}' mode[{mode_index}]='{mode_name}' \
         flags=0x{flags:08x} colors={num_colors} (début={mode_start} fin={})",
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

    // ── Données de matrice (v2+) ───────────────────────────────────────────────
    // Présentes pour TOUTES les zones en v2+, même celles sans matrice.
    // Si entry_count == 0, aucune donnée supplémentaire ne suit.
    // ⚠️  Chaque entrée de la map est un u32 (4 octets), pas 1 octet !
    if protocol_version >= 2 {
        let matrix_height = c.read_u16("zone.matrix_height")?;
        let matrix_width  = c.read_u16("zone.matrix_width")?;
        let entry_count   = c.read_u16("zone.matrix_entry_count")? as usize;
        c.skip_n(entry_count * 4, "zone.matrix_data")?;

        eprintln!(
            "[RGB][parser] '{device_name}' zone[{zone_index}]='{zone_name}' \
             matrice {matrix_height}×{matrix_width} ({entry_count} entrées)"
        );
    }

    // ── Segments (v4+) ────────────────────────────────────────────────────────
    // Les segments découpent une zone linéaire en sous-sections nommées.
    // Chaque segment : str name, u32 type, u32 start_idx, u32 leds_count.
    if protocol_version >= 4 {
        let num_segments = c.read_u16("zone.num_segments")? as usize;
        eprintln!(
            "[RGB][parser] '{device_name}' zone[{zone_index}]='{zone_name}' \
             — {num_segments} segment(s) (v4)"
        );
        for s in 0..num_segments {
            let seg_name = c.read_str("segment.name")?;
            c.skip_u32("segment.type")?;
            c.skip_u32("segment.start")?;
            c.skip_u32("segment.leds_count")?;
            eprintln!(
                "[RGB][parser] '{device_name}' zone[{zone_index}] segment[{s}]='{seg_name}'"
            );
        }
    }

    // ── Flags de zone (v5+) ───────────────────────────────────────────────────
    if protocol_version >= 5 {
        let zone_flags = c.read_u32("zone.flags")?;
        eprintln!(
            "[RGB][parser] '{device_name}' zone[{zone_index}]='{zone_name}' \
             flags=0x{zone_flags:08x} (v5)"
        );
    }

    eprintln!(
        "[RGB][parser] '{device_name}' zone[{zone_index}]='{zone_name}' \
         (début={zone_start} fin={})",
        c.pos
    );

    Ok(())
}

// ═══════════════════════════════════════════════════════════════════════════════
// Cursor — lecture séquentielle d'un slice d'octets avec messages d'erreur clairs
// ═══════════════════════════════════════════════════════════════════════════════

pub struct Cursor<'a> {
    pub data: &'a [u8],
    pub pos: usize,
}

impl<'a> Cursor<'a> {
    pub fn new(data: &'a [u8]) -> Self {
        Cursor { data, pos: 0 }
    }

    /// Vérifie qu'on peut encore lire `n` octets. Message d'erreur précis.
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

    pub fn read_i32(&mut self, field: &str) -> Result<i32, String> {
        self.require(4, field)?;
        let v = i32::from_le_bytes(self.data[self.pos..self.pos + 4].try_into().unwrap());
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

    /// Saute `n` octets (pour les tableaux de taille variable).
    /// ⚠️  Pour les tableaux de u32, passer `count * 4`, pas `count` !
    pub fn skip_n(&mut self, n: usize, field: &str) -> Result<(), String> {
        self.require(n, field)?;
        self.pos += n;
        Ok(())
    }

    /// Lit une chaîne length-prefixed.
    /// Format : u16 longueur (null inclus) + octets (dernier = \0 ignoré).
    pub fn read_str(&mut self, field: &str) -> Result<String, String> {
        let len = self.read_u16(&format!("{field}.len"))? as usize;
        if len == 0 {
            return Ok(String::new());
        }
        self.require(len, field)?;
        let bytes = &self.data[self.pos..self.pos + len];
        self.pos += len;
        let text = &bytes[..len.saturating_sub(1)]; // exclut le null-terminator
        Ok(String::from_utf8_lossy(text).to_string())
    }
}
