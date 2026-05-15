// Types partagés retournés par le pont Python vers les handlers HTTP.
use serde::Serialize;

#[derive(Serialize, Clone, Debug)]
pub struct RgbDevice {
    pub id: u32,
    pub name: String,
    pub led_count: usize,
}

#[derive(Serialize, Debug)]
pub struct RgbResponse {
    pub success: bool,
    pub error: Option<String>,
}

impl RgbResponse {
    #[allow(dead_code)]
    pub fn ok() -> Self {
        RgbResponse { success: true, error: None }
    }
    pub fn err(msg: impl Into<String>) -> Self {
        RgbResponse { success: false, error: Some(msg.into()) }
    }
}
