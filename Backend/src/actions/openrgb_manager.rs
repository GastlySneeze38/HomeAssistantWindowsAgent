use serde::Deserialize;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
use tokio::process::Child;
use tokio::sync::Mutex;

// GitLab API response structs
#[derive(Deserialize)]
struct GitLabRelease {
    assets: GitLabAssets,
}

#[derive(Deserialize)]
struct GitLabAssets {
    links: Vec<GitLabLink>,
}

#[derive(Deserialize)]
struct GitLabLink {
    name: String,
    url: String,
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
        if is_port_open(6742).await {
            println!("[RGB] OpenRGB already running on :6742, skipping managed start");
            return;
        }

        if let Err(e) = ensure_downloaded(&self.exe_path).await {
            eprintln!("[RGB] Could not install OpenRGB: {e}");
            return;
        }

        match tokio::process::Command::new(&self.exe_path)
            .args(["--server", "--headless"])
            .spawn()
        {
            Ok(child) => {
                *self.child.lock().await = Some(child);
                // Give OpenRGB time to bind the SDK port
                tokio::time::sleep(Duration::from_millis(1500)).await;
                println!("[RGB] OpenRGB server started");
            }
            Err(e) => eprintln!("[RGB] Failed to spawn OpenRGB: {e}"),
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
    base.join("tools").join("OpenRGB.exe")
}

async fn is_port_open(port: u16) -> bool {
    tokio::net::TcpStream::connect(format!("127.0.0.1:{port}"))
        .await
        .is_ok()
}

async fn ensure_downloaded(dest: &Path) -> Result<(), String> {
    if dest.exists() {
        return Ok(());
    }

    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Cannot create tools dir: {e}"))?;
    }

    println!("[RGB] OpenRGB not found, fetching latest release...");
    let url = fetch_latest_windows_url().await?;
    download_and_extract(&url, dest).await
}

async fn fetch_latest_windows_url() -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .user_agent("HomeAssistantWindowsAgent/1.0")
        .build()
        .map_err(|e| e.to_string())?;

    // OpenRGB GitLab project ID: 10582521
    let releases: Vec<GitLabRelease> = client
        .get("https://gitlab.com/api/v4/projects/10582521/releases")
        .send()
        .await
        .map_err(|e| format!("GitLab API request failed: {e}"))?
        .json()
        .await
        .map_err(|e| format!("GitLab API parse failed: {e}"))?;

    let latest = releases.first().ok_or("No OpenRGB releases found")?;

    let link = latest
        .assets
        .links
        .iter()
        .find(|l| {
            let name = l.name.to_lowercase();
            name.contains("windows") && name.contains("64")
        })
        .ok_or("No Windows 64-bit download found in latest OpenRGB release")?;

    println!("[RGB] Found release asset: {}", link.name);
    Ok(link.url.clone())
}

async fn download_and_extract(url: &str, dest: &Path) -> Result<(), String> {
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

    println!("[RGB] Downloaded {} bytes, extracting...", bytes.len());

    let cursor = Cursor::new(bytes);
    let mut archive = zip::ZipArchive::new(cursor).map_err(|e| format!("ZIP open error: {e}"))?;

    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| format!("ZIP entry error: {e}"))?;

        if entry.name().ends_with("OpenRGB.exe") {
            let mut out =
                std::fs::File::create(dest).map_err(|e| format!("Cannot create file: {e}"))?;
            std::io::copy(&mut entry, &mut out).map_err(|e| format!("Extract error: {e}"))?;
            println!("[RGB] OpenRGB.exe installed to {:?}", dest);
            return Ok(());
        }
    }

    Err("OpenRGB.exe not found inside downloaded ZIP".to_string())
}
