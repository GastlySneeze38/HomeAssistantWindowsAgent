use serde::Deserialize;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
use tokio::process::Child;
use tokio::sync::Mutex;

// Hides the console window on Windows — replaces the removed --headless flag
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

// Codeberg (Gitea) API response structs
#[derive(Deserialize)]
struct CodebergRelease {
    name: String,
    assets: Vec<CodebergAsset>,
}

#[derive(Deserialize)]
struct CodebergAsset {
    name: String,
    browser_download_url: String,
}

pub struct OpenRgbManager {
    child: Arc<Mutex<Option<Child>>>,
    exe_path: PathBuf,
}

impl OpenRgbManager {
    pub fn new() -> Self {
        OpenRgbManager {
            child: Arc::new(Mutex::new(None)),
            exe_path: resolve_exe_path(),
        }
    }

    /// Start OpenRGB headless server. Downloads the binary if missing.
    /// No-op if OpenRGB is already running on port 6742 (external instance).
    pub async fn start(&self) {
        if is_openrgb_ready().await {
            println!("[RGB] OpenRGB already running on :6742, skipping managed start");
            return;
        }

        if let Err(e) = ensure_downloaded(&self.exe_path).await {
            eprintln!("[RGB] Could not install OpenRGB: {e}");
            return;
        }

        let mut cmd = tokio::process::Command::new(&self.exe_path);
        cmd.args(["--server", "--noautoconnect"])
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped());

        // Hide the GUI window — replaces the removed --headless flag
        #[cfg(windows)]
        cmd.creation_flags(CREATE_NO_WINDOW);

        let result = cmd.spawn();

        let child = match result {
            Ok(c) => c,
            Err(e) => {
                eprintln!("[RGB] Failed to spawn OpenRGB: {e}");
                return;
            }
        };

        *self.child.lock().await = Some(child);

        // Poll port 6742 for up to 6 seconds (OpenRGB can be slow to initialize)
        let mut bound = false;
        for i in 1..=12 {
            tokio::time::sleep(Duration::from_millis(500)).await;
            if is_openrgb_ready().await {
                bound = true;
                println!("[RGB] OpenRGB SDK ready on :6742 (after {}ms)", i * 500);
                break;
            }
        }

        if !bound {
            eprintln!("[RGB] OpenRGB started but port 6742 never opened — it may have crashed.");
            eprintln!("[RGB] Tip: try running {:?} --server --headless --noautoconnect manually to see the error.", self.exe_path);
        }
    }

    /// Kill the managed OpenRGB process (called on app shutdown).
    pub async fn stop(&self) {
        let mut lock = self.child.lock().await;
        if let Some(mut child) = lock.take() {
            let _ = child.kill().await;
            let _ = child.wait().await;
            println!("[RGB] OpenRGB server stopped");
        }
    }
}

// ── helpers ──────────────────────────────────────────────────────────────────

fn resolve_exe_path() -> PathBuf {
    let base = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| PathBuf::from("."));
    // All OpenRGB files live in tools/openrgb/ — the exe and its DLLs
    base.join("tools").join("openrgb").join("OpenRGB.exe")
}

/// Check if the OpenRGB SDK server is responding by sending the proper magic handshake.
/// Using a raw TcpStream connect (without magic bytes) would trigger a warning in OpenRGB logs.
async fn is_openrgb_ready() -> bool {
    use tokio::io::AsyncWriteExt;
    let Ok(mut stream) = tokio::net::TcpStream::connect("127.0.0.1:6742").await else {
        return false;
    };
    // Send the ORGB magic so OpenRGB doesn't log a "recv_select failed" warning
    let _ = stream.write_all(b"ORGB\x00\x00\x00\x00\x32\x00\x00\x00\x1a\x00\x00\x00HomeAssistantWindowsAgent\0").await;
    true
}

async fn ensure_downloaded(dest: &Path) -> Result<(), String> {
    if dest.exists() {
        return Ok(());
    }

    // dest = …/tools/openrgb/OpenRGB.exe  →  extract_dir = …/tools/openrgb/
    let extract_dir = dest
        .parent()
        .ok_or("Cannot determine extract directory")?;

    std::fs::create_dir_all(extract_dir)
        .map_err(|e| format!("Cannot create tools dir: {e}"))?;

    println!("[RGB] OpenRGB not found, fetching latest release...");
    let url = fetch_latest_windows_url().await?;
    download_and_extract(&url, extract_dir).await
}

async fn fetch_latest_windows_url() -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .user_agent("HomeAssistantWindowsAgent/1.0")
        .build()
        .map_err(|e| e.to_string())?;

    // OpenRGB moved to Codeberg (Gitea-compatible API)
    let releases: Vec<CodebergRelease> = client
        .get("https://codeberg.org/api/v1/repos/OpenRGB/OpenRGB/releases?limit=10")
        .send()
        .await
        .map_err(|e| format!("Codeberg API request failed: {e}"))?
        .json()
        .await
        .map_err(|e| format!("Codeberg API parse failed: {e}"))?;

    // Find first release (non-WinRing0) that has a Windows 64-bit ZIP asset
    for release in &releases {
        if release.name.to_lowercase().contains("winring0") {
            continue;
        }
        if let Some(asset) = release.assets.iter().find(|a| {
            let name = a.name.to_lowercase();
            name.contains("windows") && name.contains("64") && name.ends_with(".zip")
        }) {
            println!("[RGB] Found: {} (from {})", asset.name, release.name);
            return Ok(asset.browser_download_url.clone());
        }
    }

    Err("No Windows 64-bit ZIP found in any OpenRGB release".to_string())
}

/// Extract the full ZIP contents into `extract_dir`, stripping the top-level folder.
/// OpenRGB zips look like:  OpenRGB_x.x_Windows_64_xxx/OpenRGB.exe
///                          OpenRGB_x.x_Windows_64_xxx/Qt6Core.dll  …
/// We drop that first path segment so everything lands flat in extract_dir.
async fn download_and_extract(url: &str, extract_dir: &Path) -> Result<(), String> {
    println!("[RGB] Downloading OpenRGB from {url}");

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .user_agent("HomeAssistantWindowsAgent/1.0")
        .build()
        .map_err(|e| e.to_string())?;

    let bytes = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Download failed: {e}"))?
        .bytes()
        .await
        .map_err(|e| format!("Download read failed: {e}"))?;

    println!("[RGB] Downloaded {} bytes, extracting all files...", bytes.len());

    let cursor = Cursor::new(bytes);
    let mut archive = zip::ZipArchive::new(cursor).map_err(|e| format!("ZIP open error: {e}"))?;

    let mut exe_found = false;

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| format!("ZIP entry {i}: {e}"))?;

        // Strip the leading folder component (e.g. "OpenRGB_1.0rc2_Windows_64_xxx/")
        let raw_name = entry.name().to_string();
        let relative = raw_name
            .splitn(2, '/')
            .nth(1)
            .unwrap_or(&raw_name);

        if relative.is_empty() || entry.is_dir() {
            continue;
        }

        let out_path = extract_dir.join(relative);

        if let Some(parent) = out_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("mkdir {:?}: {e}", parent))?;
        }

        let mut out = std::fs::File::create(&out_path)
            .map_err(|e| format!("Create {:?}: {e}", out_path))?;
        std::io::copy(&mut entry, &mut out)
            .map_err(|e| format!("Write {:?}: {e}", out_path))?;

        if relative == "OpenRGB.exe" {
            exe_found = true;
            println!("[RGB] Extracted OpenRGB.exe → {:?}", out_path);
        }
    }

    if exe_found {
        println!("[RGB] OpenRGB installation complete in {:?}", extract_dir);
        Ok(())
    } else {
        Err("OpenRGB.exe not found inside downloaded ZIP".to_string())
    }
}
