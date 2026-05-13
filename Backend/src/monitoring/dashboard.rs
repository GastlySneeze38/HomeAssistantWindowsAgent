use serde::Serialize;
use sysinfo::{Networks, System};

// ── CPU ───────────────────────────────────────────────────────────────────────

#[derive(Serialize, Clone)]
pub struct CpuInfo {
    pub usage_percent: f32,
    pub frequency_mhz: u64,
    pub core_count: usize,
    pub temperature_celsius: Option<f64>,
}

// ── RAM ───────────────────────────────────────────────────────────────────────

#[derive(Serialize, Clone)]
pub struct RamInfo {
    pub total_gb: f64,
    pub used_gb: f64,
    pub available_gb: f64,
    pub usage_percent: f32,
}

// ── Réseau ────────────────────────────────────────────────────────────────────

#[derive(Serialize, Clone)]
pub struct NetworkInfo {
    pub name: String,
    pub received_kb: f64,
    pub transmitted_kb: f64,
}

// ── GPU NVIDIA (nvml-wrapper) ─────────────────────────────────────────────────

#[derive(Serialize, Clone)]
pub struct GpuInfo {
    pub name: String,
    pub usage_percent: u32,
    pub vram_total_mb: u64,
    pub vram_used_mb: u64,
    pub temperature_celsius: u32,
}

// ── Fenêtres Windows actives (windows-rs) ────────────────────────────────────

#[derive(Serialize, Clone)]
pub struct WindowInfo {
    pub title: String,
}

// ── Dashboard complet ─────────────────────────────────────────────────────────

#[derive(Serialize, Clone)]
pub struct DashboardData {
    pub cpu: CpuInfo,
    pub ram: RamInfo,
    pub network: Vec<NetworkInfo>,
    pub uptime_seconds: u64,
    pub gpu: Option<GpuInfo>,
    pub active_windows: Vec<WindowInfo>,
}

// ── Collecteur persistant ─────────────────────────────────────────────────────

pub struct DashboardCollector {
    sys: System,
    nets: Networks,
}

impl DashboardCollector {
    pub fn new() -> Self {
        Self {
            sys: System::new_all(),
            nets: Networks::new_with_refreshed_list(),
        }
    }

    pub fn collect(&mut self) -> DashboardData {
        self.sys.refresh_all();
        self.nets.refresh();

        // CPU
        let cpu_usage = self.sys.global_cpu_info().cpu_usage();
        let cpu_freq = self.sys.cpus().first().map(|c| c.frequency()).unwrap_or(0);
        let core_count = self.sys.cpus().len();
        let cpu_temp = collect_cpu_temperature();

        // RAM
        let gb = |bytes: u64| bytes as f64 / (1024.0 * 1024.0 * 1024.0);
        let ram_total = gb(self.sys.total_memory());
        let ram_avail = gb(self.sys.available_memory());
        let ram_used = gb(self.sys.used_memory());
        let ram_pct = if self.sys.total_memory() > 0 {
            self.sys.used_memory() as f32 / self.sys.total_memory() as f32 * 100.0
        } else {
            0.0
        };

        // Réseau — uniquement les interfaces qui font passer des données
        let network = self.nets
            .iter()
            .filter(|(_, data)| data.received() > 0 || data.transmitted() > 0)
            .map(|(name, data)| NetworkInfo {
                name: name.clone(),
                received_kb: data.received() as f64 / 1024.0,
                transmitted_kb: data.transmitted() as f64 / 1024.0,
            })
            .collect();

        DashboardData {
            cpu: CpuInfo {
                usage_percent: cpu_usage,
                frequency_mhz: cpu_freq,
                core_count,
                temperature_celsius: cpu_temp,
            },
            ram: RamInfo {
                total_gb: ram_total,
                used_gb: ram_used,
                available_gb: ram_avail,
                usage_percent: ram_pct,
            },
            network,
            uptime_seconds: System::uptime(),
            gpu: collect_gpu_info(),
            active_windows: collect_active_windows(),
        }
    }
}

// ── GPU via nvml-wrapper ──────────────────────────────────────────────────────

fn collect_gpu_info() -> Option<GpuInfo> {
    use nvml_wrapper::{enum_wrappers::device::TemperatureSensor, Nvml};

    let nvml = Nvml::init().ok()?;
    let device = nvml.device_by_index(0).ok()?;

    Some(GpuInfo {
        name: device.name().ok()?,
        usage_percent: device.utilization_rates().ok()?.gpu,
        vram_total_mb: device.memory_info().ok()?.total / (1024 * 1024),
        vram_used_mb: device.memory_info().ok()?.used / (1024 * 1024),
        temperature_celsius: device.temperature(TemperatureSensor::Gpu).ok()?,
    })
}

// ── Température CPU via WMI (LibreHardwareMonitor) ───────────────────────────
//
// LHM doit être lancé sur le PC et exposer son namespace WMI.
// Si LHM n'est pas actif, retourne None sans erreur.

fn collect_cpu_temperature() -> Option<f64> {
    use std::collections::HashMap;
    use wmi::{COMLibrary, WMIConnection};

    let com = COMLibrary::new().ok()?;
    let wmi = WMIConnection::with_namespace_path("root\\LibreHardwareMonitor", com).ok()?;

    let results: Vec<HashMap<String, serde_json::Value>> = wmi
        .raw_query("SELECT Value FROM Sensor WHERE SensorType='Temperature' AND Parent LIKE '%cpu%'")
        .ok()?;

    let temps: Vec<f64> = results
        .iter()
        .filter_map(|row| row.get("Value")?.as_f64())
        .filter(|&v| v > 0.0 && v < 120.0)
        .collect();

    if temps.is_empty() {
        return None;
    }

    Some(temps.iter().cloned().fold(f64::NEG_INFINITY, f64::max))
}

// ── Fenêtres actives via windows-rs ──────────────────────────────────────────

fn collect_active_windows() -> Vec<WindowInfo> {
    use windows::Win32::Foundation::{BOOL, HWND, LPARAM};
    use windows::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetWindowTextLengthW, GetWindowTextW, IsWindowVisible,
    };

    let mut windows: Vec<WindowInfo> = Vec::new();
    let ptr = &mut windows as *mut Vec<WindowInfo> as isize;

    unsafe extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        unsafe {
            let windows = &mut *(lparam.0 as *mut Vec<WindowInfo>);

            if !IsWindowVisible(hwnd).as_bool() {
                return BOOL(1);
            }

            let len = GetWindowTextLengthW(hwnd);
            if len == 0 {
                return BOOL(1);
            }

            let mut buf = vec![0u16; (len + 1) as usize];
            let written = GetWindowTextW(hwnd, &mut buf);
            if written > 0 {
                let title = String::from_utf16_lossy(&buf[..written as usize]);
                windows.push(WindowInfo { title });
            }

            BOOL(1)
        }
    }

    unsafe {
        let _ = EnumWindows(Some(enum_proc), LPARAM(ptr));
    }

    windows
}
