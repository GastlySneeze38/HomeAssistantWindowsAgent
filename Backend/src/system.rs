use serde::Serialize;
use sysinfo::System;

#[derive(Serialize)]
pub struct SystemInfo {
    pub available_ram_gb: f64,
}

// Fonction pour obtenir la RAM disponible en GB
pub fn get_available_ram() -> f64 {
    let mut sys = System::new_all();
    sys.refresh_all();

    let available_memory = sys.available_memory() as f64;
    available_memory / (1024.0 * 1024.0 * 1024.0) // Convertir en GB
}