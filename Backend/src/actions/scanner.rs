use std::collections::HashMap;
use std::path::Path;
use std::sync::LazyLock;
use regex::Regex;

// ── Blacklists (ported from scan_programs.ps1) ────────────────────────────────

static EXE_BLACKLIST: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)^(unins|uninst|uninstall|setup|install|installer|update|updater|crash|helper|report|patcher|redist|vcredist|runtime|prerequisit|7z|gengal|oemdrv|jabswitch|nvconta|nvfvsd|writer|node|python|pythonw|powershell|cmd|msiexec|soffice)$").unwrap()
});

static PATH_BLACKLIST: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)(\\Package Cache\\|\\system32\\|\\syswow64\\|\\WINDOWS\\|\\Windows\\System|NvContainer|FrameViewSDK|WebView2|system_tray|\\CEF\\|\\bin64\\7z|CIM\\BIN)").unwrap()
});

static NAME_BLACKLIST: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)(uninstall|désinstaller|\binstall\b|setup|redistributable|runtime|visual c\+\+|\.net |directx|\bsdk\b|\bdriver\b|chipset|\bhal\b|vanguard|rockstar.*sdk|nvidia container|nvidia frame|edge webview|launcher prerequisites|windows desktop runtime|windows software development kit|visual studio installer|java.*se development kit|libreoffice base|libreoffice draw|libreoffice impress|libreoffice math|libreoffice writer|libreoffice calc|libreoffice 25|rawaccel|msi center|overwolf$|git (cmd|gui|bash)|roblox studio|microsoft visual studio code|node\.js|python 3\.|windows media player|copilot|onedrive|windows powersh|windows fax|technitium|ollama version|docker desktop)").unwrap()
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
    // Filter blacklists
    let filtered: Vec<ScannedApp> = apps
        .into_iter()
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

    // Dedup by name — keep shortest path
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
            let Some(target) = resolve_lnk(&lnk_path) else { continue };
            if !target.to_lowercase().ends_with(".exe") || !Path::new(&target).exists() {
                continue;
            }
            let name = lnk_path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .trim()
                .to_string();
            if name.is_empty() { continue; }
            let key = target.to_lowercase();
            programs.entry(key).or_insert(ScannedApp { name, command: target });
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

/// Parses an .lnk file (MS-SHLLINK spec) and returns the LocalBasePath.
/// Handles the vast majority of installed-app shortcuts.
fn resolve_lnk(lnk_path: &Path) -> Option<String> {
    let data = std::fs::read(lnk_path).ok()?;
    if data.len() < 76 { return None; }

    // Magic: 0x4C000000 LE
    if data[0..4] != [0x4C, 0x00, 0x00, 0x00] { return None; }

    let link_flags = u32::from_le_bytes(data[20..24].try_into().ok()?);

    let mut offset = 76usize; // ShellLinkHeader is always 76 bytes

    // HasLinkTargetIDList (bit 0) → skip IDList block
    if link_flags & 1 != 0 {
        if offset + 2 > data.len() { return None; }
        let id_list_size = u16::from_le_bytes(data[offset..offset + 2].try_into().ok()?) as usize;
        offset += 2 + id_list_size;
    }

    // HasLinkInfo (bit 1) → read LocalBasePath
    if link_flags & 2 != 0 {
        if offset + 28 > data.len() { return None; }

        let link_info_size = u32::from_le_bytes(data[offset..offset + 4].try_into().ok()?) as usize;
        let local_base_path_rel = u32::from_le_bytes(data[offset + 16..offset + 20].try_into().ok()?) as usize;

        if local_base_path_rel > 0 {
            let path_start = offset + local_base_path_rel;
            if path_start < data.len() {
                let end = data[path_start..].iter().position(|&b| b == 0).unwrap_or(0);
                if end > 0 {
                    if let Ok(path) = std::str::from_utf8(&data[path_start..path_start + end]) {
                        return Some(path.to_string());
                    }
                }
            }
        }

        offset += link_info_size;
        let _ = offset; // silence unused warning
    }

    None
}
