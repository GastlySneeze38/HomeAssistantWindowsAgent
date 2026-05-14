use openrgb::{data::Color, OpenRGB};
use serde::Serialize;

#[derive(Serialize)]
pub struct RgbDevice {
    pub id: u32,
    pub name: String,
    pub led_count: usize,
}

#[derive(Serialize)]
pub struct RgbResponse {
    pub success: bool,
    pub error: Option<String>,
}

async fn connect() -> Result<OpenRGB<tokio::net::TcpStream>, String> {
    OpenRGB::connect().await.map_err(|e| format!("Cannot connect to OpenRGB: {}", e))
}

pub async fn get_devices() -> Result<Vec<RgbDevice>, String> {
    let client = connect().await?;
    let count = client
        .get_controller_count()
        .await
        .map_err(|e| e.to_string())?;

    let mut devices = Vec::new();
    for i in 0..count {
        if let Ok(ctrl) = client.get_controller(i).await {
            devices.push(RgbDevice {
                id: i,
                name: ctrl.name,
                led_count: ctrl.leds.len(),
            });
        }
    }
    Ok(devices)
}

pub async fn set_color(r: u8, g: u8, b: u8, device_id: Option<u32>) -> RgbResponse {
    match apply_color(r, g, b, device_id).await {
        Ok(_) => RgbResponse { success: true, error: None },
        Err(e) => RgbResponse { success: false, error: Some(e) },
    }
}

pub async fn turn_off(device_id: Option<u32>) -> RgbResponse {
    set_color(0, 0, 0, device_id).await
}

async fn apply_color(r: u8, g: u8, b: u8, device_id: Option<u32>) -> Result<(), String> {
    let client = connect().await?;
    let count = client
        .get_controller_count()
        .await
        .map_err(|e| e.to_string())?;

    let color = Color::new(r, g, b);

    let targets: Vec<u32> = match device_id {
        Some(id) if id < count => vec![id],
        Some(id) => return Err(format!("Device {} not found (total: {})", id, count)),
        None => (0..count).collect(),
    };

    for id in targets {
        let ctrl = client.get_controller(id).await.map_err(|e| e.to_string())?;
        let leds = vec![color; ctrl.leds.len()];
        client.update_leds(id, leds).await.map_err(|e| e.to_string())?;
    }
    Ok(())
}
