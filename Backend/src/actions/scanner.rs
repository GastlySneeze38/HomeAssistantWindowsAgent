use std::collections::HashMap;
use std::path::Path;
use std::sync::LazyLock;
use regex::Regex;

// ── Blacklists (ported from scan_programs.ps1) ────────────────────────────────

static EXE_BLACKLIST: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)^(unins|uninst|uninstall|setup|install|installer|update|updater|crash|helper|report|patcher|redist|vcredist|runtime|prerequisit|7z|gengal|oemdrv|jabswitch|nvconta|nvfvsd|writer|node|python|pythonw|powershell|cmd|msiexec|soffice)$").unwrap()
});

static PATH_BLACKLIST: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)(\\Package Cache\\|\\system32\\|\\syswow64\\|\\SysWOW64\\|\\WINDOWS\\|\\Windows\\System|NvContainer|FrameViewSDK|WebView2|system_tray|\\CEF\\|\\bin64\\7z|CIM\\BIN|\\WindowsApps\\|\\Microsoft\\WindowsApps)").unwrap()
});

static NAME_BLACKLIST: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)(uninstall|désinstaller|install|setup|redistributable|runtime|visual c\+\+|\.net |directx|\bsdk\b|driver|chipset|\bhal\b|vanguard|rockstar.*sdk|wd.*p40|wd_black|verbatim|\bene \b|nvidia container|nvidia frame|edge webview|launcher prerequisites|windows desktop runtime|windows software development kit|windows app cert kit|visual studio installer|java.*se development kit|install additional tools|mode sans échec|safe mode|keyz rubidium|dropbox redeem|launch4j|\bidle\b.*python|libreoffice base|libreoffice draw|libreoffice impress|libreoffice math|libreoffice writer|libreoffice calc|libreoffice 25|writer\.exe|rawaccel|msi center|mumble \(client\)|logitech.*system.tray|overwolf$|git (cmd|gui|bash)|roblox.*for |roblox studio|microsoft visual studio code|node\.js|python 3\.|windows media player|copilot|onedrive|windows powersh|windows fax|technitium|ollama version|docker desktop)").unwrap()
});

static VERSION_SUFFIX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\s+\d[\d\.]+.*$").unwrap()
});

static TRAIL_WORDS: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)\s+(launcher|client|player|app|stable|community edition).*$").unwrap()
});

static NON_ALNUM: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"[^\w\s]").unwrap()
});

// Squirrel launcher pattern: Update.exe --processStart X.exe
static SQUIRREL_PROCESS_START: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)--processStart\s+([^\s]+\.exe)").unwrap()
});

// ── Types ─────────────────────────────────────────────────────────────────────

#[derive(Clone, Debug)]
pub struct ScannedApp {
    pub name: String,
    pub command: String,
}

// ── Alias / close_processes generation ───────────────────────────────────────

pub fn make_aliases(name: &str) -> String {
    let mut aliases = std::collections::HashSet::new();

    let base = name.to_lowercase();
    aliases.insert(base.clone());
    aliases.insert(base.replace(' ', ""));

    if let Some(first) = base.split_whitespace().next() {
        aliases.insert(first.to_string());
    }

    let stripped = VERSION_SUFFIX.replace(&base, "").trim().to_string();
    aliases.insert(stripped.clone());
    aliases.insert(stripped.replace(' ', ""));

    let short = TRAIL_WORDS.replace(&base, "").trim().to_string();
    aliases.insert(short.clone());
    aliases.insert(short.replace(' ', ""));

    let clean = NON_ALNUM.replace_all(&base, "").trim().to_string();
    let clean = clean.split_whitespace().collect::<Vec<_>>().join(" ");
    aliases.insert(clean.clone());
    aliases.insert(clean.replace(' ', ""));

    let mut result: Vec<String> = aliases
        .into_iter()
        .filter(|a| !a.is_empty() && !a.chars().all(|c| c.is_ascii_digit() || c == '.'))
        .collect();
    result.sort();
    result.join(",")
}

pub fn make_close_processes(command: &str) -> String {
    let exe = Path::new(command)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_string();

    let extras: HashMap<&str, Vec<&str>> = HashMap::from([
        ("valorant.exe", vec!["VALORANT-Win64-Shipping.exe", "RiotClientServices.exe", "RiotClientCrashHandler.exe"]),
        ("riotclientservices.exe", vec!["RiotClientServices.exe", "RiotClientCrashHandler.exe"]),
        ("steam.exe", vec!["steam.exe", "steamwebhelper.exe"]),
        ("discord.exe", vec!["Discord.exe", "DiscordCrashHandler.exe"]),
        ("obs64.exe", vec!["obs64.exe", "obs32.exe"]),
        ("epicgameslauncher.exe", vec!["EpicGamesLauncher.exe", "EpicWebHelper.exe"]),
    ]);

    let key = exe.to_lowercase();
    if let Some(procs) = extras.get(key.as_str()) {
        procs.join(",")
    } else {
        exe
    }
}

// ── Filtering & dedup ─────────────────────────────────────────────────────────

pub fn filter_and_dedup(apps: Vec<ScannedApp>) -> Vec<ScannedApp> {
    // STEP 1: Command-level dedup across all sources.
    // Registry entries often have versioned names ("Blender 4.2.3") while Start Menu
    // shortcuts for the same exe have cleaner names ("Blender").
    // Prefer the entry with the shorter name (Start Menu names are usually cleaner).
    let mut by_command: HashMap<String, ScannedApp> = HashMap::new();
    for app in apps {
        let key = app.command.to_lowercase();
        let entry = by_command.entry(key).or_insert_with(|| app.clone());
        if app.name.len() < entry.name.len() {
            *entry = app;
        }
    }

    // STEP 2: Apply blacklist filters
    let filtered: Vec<ScannedApp> = by_command
        .into_values()
        .filter(|app| {
            let exe_stem = Path::new(&app.command)
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("");

            if EXE_BLACKLIST.is_match(exe_stem) { return false; }
            if PATH_BLACKLIST.is_match(&app.command) { return false; }
            if NAME_BLACKLIST.is_match(&app.name) { return false; }
            true
        })
        .collect();

    // STEP 3: Name-level dedup — same logical app with different exe paths,
    // keep the shortest path (usually the main executable, not a subfolder variant).
    let mut by_name: HashMap<String, ScannedApp> = HashMap::new();
    for app in filtered {
        let key = app.name.to_lowercase();
        let entry = by_name.entry(key).or_insert_with(|| app.clone());
        if app.command.len() < entry.command.len() {
            *entry = app;
        }
    }

    let mut result: Vec<ScannedApp> = by_name.into_values().collect();
    result.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    result
}

// ── Registry scan ─────────────────────────────────────────────────────────────

pub fn scan_registry() -> Vec<ScannedApp> {
    use winreg::enums::*;
    use winreg::RegKey;

    let mut programs: HashMap<String, ScannedApp> = HashMap::new();

    let paths: &[(_, &str)] = &[
        (HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
        (HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"),
        (HKEY_CURRENT_USER, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
    ];

    for (hive, path) in paths {
        let Ok(key) = RegKey::predef(*hive).open_subkey(path) else { continue };

        for subkey_name in key.enum_keys().flatten() {
            let Ok(subkey) = key.open_subkey(&subkey_name) else { continue };

            let name: String = subkey.get_value("DisplayName").unwrap_or_default();
            if name.trim().is_empty() { continue; }

            let mut exe: Option<String> = None;

            // DisplayIcon first (strip ",index" suffix)
            let icon: String = subkey.get_value("DisplayIcon").unwrap_or_default();
            if !icon.is_empty() {
                let raw = icon.split(',').next().unwrap_or("").trim_matches('"').trim().to_string();
                if raw.to_lowercase().ends_with(".exe") && Path::new(&raw).exists() {
                    exe = Some(raw);
                }
            }

            // Fallback: first non-system exe in InstallLocation
            if exe.is_none() {
                let location: String = subkey.get_value("InstallLocation").unwrap_or_default();
                if !location.is_empty() {
                    let dir = location.trim_matches('"').trim();
                    if Path::new(dir).exists() {
                        if let Ok(entries) = std::fs::read_dir(dir) {
                            for entry in entries.flatten() {
                                let p = entry.path();
                                let ext = p.extension().and_then(|e| e.to_str()).unwrap_or("");
                                let stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
                                if ext.eq_ignore_ascii_case("exe")
                                    && !stem.contains("unins")
                                    && !stem.contains("setup")
                                    && !stem.contains("update")
                                    && !stem.contains("crash")
                                    && !stem.contains("helper")
                                    && !stem.contains("report")
                                {
                                    exe = Some(p.to_string_lossy().to_string());
                                    break;
                                }
                            }
                        }
                    }
                }
            }

            if let Some(cmd) = exe {
                let key = cmd.to_lowercase();
                programs.entry(key).or_insert(ScannedApp {
                    name: name.trim().to_string(),
                    command: cmd,
                });
            }
        }
    }

    programs.into_values().collect()
}

// ── Start Menu scan (.lnk) ────────────────────────────────────────────────────

pub fn scan_start_menu() -> Vec<ScannedApp> {
    let mut programs: HashMap<String, ScannedApp> = HashMap::new();

    let dirs = [
        std::env::var("PROGRAMDATA").unwrap_or_default()
            + r"\Microsoft\Windows\Start Menu\Programs",
        std::env::var("APPDATA").unwrap_or_default()
            + r"\Microsoft\Windows\Start Menu\Programs",
    ];

    for dir in &dirs {
        let lnk_files = collect_lnk_files(Path::new(dir), 4);
        for lnk_path in lnk_files {
            let Some(lnk) = resolve_lnk(&lnk_path) else { continue };

            // Squirrel launchers: Update.exe --processStart X.exe → resolve real exe
            let effective = squirrel_resolve(&lnk).unwrap_or_else(|| lnk.target.clone());

            if !effective.to_lowercase().ends_with(".exe") || !Path::new(&effective).exists() {
                continue;
            }
            let name = lnk_path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .trim()
                .to_string();
            if name.is_empty() { continue; }
            let key = effective.to_lowercase();
            programs.entry(key).or_insert(ScannedApp { name, command: effective });
        }
    }

    programs.into_values().collect()
}

fn collect_lnk_files(dir: &Path, depth: usize) -> Vec<std::path::PathBuf> {
    if depth == 0 || !dir.exists() { return vec![]; }
    let Ok(entries) = std::fs::read_dir(dir) else { return vec![]; };
    let mut result = vec![];
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            result.extend(collect_lnk_files(&path, depth - 1));
        } else if path.extension().and_then(|e| e.to_str()).map(|e| e.eq_ignore_ascii_case("lnk")).unwrap_or(false) {
            result.push(path);
        }
    }
    result
}

struct LnkResolved {
    target: String,
    working_dir: Option<String>,
    arguments: Option<String>,
}

/// Parses an .lnk file (MS-SHLLINK spec).
/// Reads LocalBasePath (ANSI + Unicode fallback), WorkingDir, and Arguments.
fn resolve_lnk(lnk_path: &Path) -> Option<LnkResolved> {
    let data = std::fs::read(lnk_path).ok()?;
    if data.len() < 76 { return None; }
    if data[0..4] != [0x4C, 0x00, 0x00, 0x00] { return None; }

    let link_flags = u32::from_le_bytes(data[20..24].try_into().ok()?);
    let mut offset = 76usize;

    // HasLinkTargetIDList (bit 0) → skip IDList block
    if link_flags & 1 != 0 {
        if offset + 2 > data.len() { return None; }
        let id_list_size = u16::from_le_bytes(data[offset..offset + 2].try_into().ok()?) as usize;
        offset += 2 + id_list_size;
    }

    let mut target: Option<String> = None;

    // HasLinkInfo (bit 1) → read LocalBasePath (ANSI first, then Unicode)
    if link_flags & 2 != 0 {
        if offset + 28 > data.len() { return None; }

        let link_info_size = u32::from_le_bytes(data[offset..offset + 4].try_into().ok()?) as usize;
        let header_size    = u32::from_le_bytes(data[offset + 4..offset + 8].try_into().ok()?) as usize;
        let local_base_rel = u32::from_le_bytes(data[offset + 16..offset + 20].try_into().ok()?) as usize;

        // ANSI path
        if local_base_rel > 0 {
            let start = offset + local_base_rel;
            if start < data.len() {
                let end = data[start..].iter().position(|&b| b == 0).unwrap_or(0);
                if end > 0 {
                    if let Ok(s) = std::str::from_utf8(&data[start..start + end]) {
                        target = Some(s.to_string());
                    }
                }
            }
        }

        // Unicode path (only if header >= 36 and ANSI was empty)
        if target.is_none() && header_size >= 36 && offset + 32 < data.len() {
            let unicode_rel = u32::from_le_bytes(data[offset + 28..offset + 32].try_into().ok()?) as usize;
            if unicode_rel > 0 {
                let start = offset + unicode_rel;
                if start < data.len() {
                    let chars: Vec<u16> = data[start..]
                        .chunks_exact(2)
                        .take_while(|c| c[0] != 0 || c[1] != 0)
                        .map(|c| u16::from_le_bytes([c[0], c[1]]))
                        .collect();
                    if !chars.is_empty() {
                        target = String::from_utf16(&chars).ok();
                    }
                }
            }
        }

        offset += link_info_size;
    }

    let target = target?;

    // StringData: CountedString (2-byte UTF-16 char count + UTF-16LE chars, no null)
    let read_counted = |off: &mut usize| -> Option<String> {
        if *off + 2 > data.len() { return None; }
        let count = u16::from_le_bytes(data[*off..*off + 2].try_into().ok()?) as usize;
        *off += 2;
        if *off + count * 2 > data.len() { *off += count * 2; return None; }
        let chars: Vec<u16> = data[*off..*off + count * 2]
            .chunks_exact(2)
            .map(|c| u16::from_le_bytes([c[0], c[1]]))
            .collect();
        *off += count * 2;
        String::from_utf16(&chars).ok()
    };

    // Bit 2: HasName, Bit 3: HasRelativePath, Bit 4: HasWorkingDir, Bit 5: HasArguments
    if link_flags & (1 << 2) != 0 { read_counted(&mut offset); } // NAME_STRING (skip)
    if link_flags & (1 << 3) != 0 { read_counted(&mut offset); } // RELATIVE_PATH (skip)
    let working_dir = if link_flags & (1 << 4) != 0 { read_counted(&mut offset) } else { None };
    let arguments   = if link_flags & (1 << 5) != 0 { read_counted(&mut offset) } else { None };

    Some(LnkResolved { target, working_dir, arguments })
}

/// Squirrel installer pattern: shortcut → Update.exe --processStart RealApp.exe
/// WorkingDirectory = app-X.X.XXXX\ folder containing the real exe.
fn squirrel_resolve(lnk: &LnkResolved) -> Option<String> {
    let stem = Path::new(&lnk.target)
        .file_stem()
        .and_then(|s| s.to_str())?
        .to_lowercase();
    if stem != "update" { return None; }

    let args = lnk.arguments.as_deref().unwrap_or("");
    let cap = SQUIRREL_PROCESS_START.captures(args)?;
    let exe_name = cap.get(1)?.as_str();

    // First try WorkingDirectory (most reliable)
    if let Some(wd) = &lnk.working_dir {
        let p = Path::new(wd).join(exe_name);
        if p.exists() { return Some(p.to_string_lossy().to_string()); }
    }

    // Fallback: scan sibling directories of Update.exe for the exe
    let parent = Path::new(&lnk.target).parent()?;
    for entry in std::fs::read_dir(parent).ok()?.flatten() {
        let candidate = entry.path().join(exe_name);
        if candidate.exists() {
            return Some(candidate.to_string_lossy().to_string());
        }
    }

    None
}
