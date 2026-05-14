// Direct OpenRGB SDK protocol implementation (no external crate).
// Negotiates protocol v3 (brightness in modes, height+width in zone matrix).
use serde::Serialize;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::time::timeout;

const MAGIC: &[u8; 4] = b"ORGB";
const CMD_REQUEST_COUNT: u32 = 0;
const CMD_REQUEST_CONTROLLER_DATA: u32 = 1;
const CMD_REQUEST_PROTOCOL_VERSION: u32 = 40;
const CMD_SET_CLIENT_NAME: u32 = 50;
const CMD_UPDATE_LEDS: u32 = 1100;
const IO_TIMEOUT: Duration = Duration::from_secs(3);
// v3: adds brightness fields in modes + separate matrix_height/width in zones
const PROTOCOL_VERSION: u32 = 3;

// ── Public types ─────────────────────────────────────────────────────────────

#[derive(Serialize, Clone)]
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

// ── Public API ────────────────────────────────────────────────────────────────

pub async fn get_devices() -> Result<Vec<RgbDevice>, String> {
    let mut c = OrgbClient::connect().await?;
    let count = c.get_controller_count().await?;

    let mut devices = Vec::new();
    for i in 0..count {
        match c.get_controller_info(i).await {
            Ok((name, led_count)) => devices.push(RgbDevice { id: i, name, led_count }),
            Err(e) => {
                eprintln!("[RGB] Could not parse device {i}: {e}");
                devices.push(RgbDevice {
                    id: i,
                    name: format!("Device {i}"),
                    led_count: 0,
                });
            }
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
    let mut c = OrgbClient::connect().await?;
    let count = c.get_controller_count().await?;

    let targets: Vec<u32> = match device_id {
        Some(id) if id < count => vec![id],
        Some(id) => return Err(format!("Device {id} not found (total: {count})")),
        None => (0..count).collect(),
    };

    for id in targets {
        let (_, led_count) = c.get_controller_info(id).await?;
        if led_count > 0 {
            c.update_leds(id, r, g, b, led_count).await?;
        }
    }
    Ok(())
}

// ── TCP client ────────────────────────────────────────────────────────────────

struct OrgbClient {
    stream: TcpStream,
}

impl OrgbClient {
    async fn connect() -> Result<Self, String> {
        let stream = timeout(IO_TIMEOUT, TcpStream::connect("127.0.0.1:6742"))
            .await
            .map_err(|_| "OpenRGB connection timed out".to_string())?
            .map_err(|e| format!("Cannot connect to OpenRGB SDK on :6742 — {e}"))?;

        let mut client = OrgbClient { stream };

        // 1. Identify ourselves
        client.send(0, CMD_SET_CLIENT_NAME, b"HomeAssistantWindowsAgent\0").await?;

        // 2. Negotiate protocol version — server replies with min(ours, theirs)
        client
            .send(0, CMD_REQUEST_PROTOCOL_VERSION, &PROTOCOL_VERSION.to_le_bytes())
            .await?;
        client.recv().await?; // consume reply (we ignore the negotiated value; we asked for v1)

        Ok(client)
    }

    async fn send(&mut self, device_idx: u32, cmd: u32, data: &[u8]) -> Result<(), String> {
        let mut buf = Vec::with_capacity(16 + data.len());
        buf.extend_from_slice(MAGIC);
        buf.extend_from_slice(&device_idx.to_le_bytes());
        buf.extend_from_slice(&cmd.to_le_bytes());
        buf.extend_from_slice(&(data.len() as u32).to_le_bytes());
        buf.extend_from_slice(data);
        timeout(IO_TIMEOUT, self.stream.write_all(&buf))
            .await
            .map_err(|_| "OpenRGB write timed out".to_string())?
            .map_err(|e| e.to_string())
    }

    async fn recv(&mut self) -> Result<(u32, u32, Vec<u8>), String> {
        let mut hdr = [0u8; 16];
        timeout(IO_TIMEOUT, self.stream.read_exact(&mut hdr))
            .await
            .map_err(|_| "OpenRGB read timed out".to_string())?
            .map_err(|e| format!("Header read: {e}"))?;

        if &hdr[0..4] != MAGIC {
            return Err(format!("Bad OpenRGB magic: {:?}", &hdr[0..4]));
        }
        let device_idx = u32::from_le_bytes(hdr[4..8].try_into().unwrap());
        let command = u32::from_le_bytes(hdr[8..12].try_into().unwrap());
        let data_len = u32::from_le_bytes(hdr[12..16].try_into().unwrap()) as usize;

        let mut data = vec![0u8; data_len];
        if data_len > 0 {
            timeout(IO_TIMEOUT, self.stream.read_exact(&mut data))
                .await
                .map_err(|_| "OpenRGB data read timed out".to_string())?
                .map_err(|e| format!("Data read: {e}"))?;
        }
        Ok((device_idx, command, data))
    }

    async fn get_controller_count(&mut self) -> Result<u32, String> {
        self.send(0, CMD_REQUEST_COUNT, &[]).await?;
        let (_, _, data) = self.recv().await?;
        if data.len() < 4 {
            return Err(format!("Short count response ({} bytes)", data.len()));
        }
        Ok(u32::from_le_bytes(data[0..4].try_into().unwrap()))
    }

    async fn get_controller_info(&mut self, idx: u32) -> Result<(String, usize), String> {
        self.send(idx, CMD_REQUEST_CONTROLLER_DATA, &[]).await?;
        let (_, _, data) = self.recv().await?;
        parse_controller_info(&data)
    }

    async fn update_leds(
        &mut self,
        device_idx: u32,
        r: u8,
        g: u8,
        b: u8,
        led_count: usize,
    ) -> Result<(), String> {
        // Payload: u32 color_bytes_count  +  led_count × [B, G, R, 0x00]
        let color_bytes = (led_count * 4) as u32;
        let mut payload = Vec::with_capacity(4 + led_count * 4);
        payload.extend_from_slice(&color_bytes.to_le_bytes());
        for _ in 0..led_count {
            payload.push(b);
            payload.push(g);
            payload.push(r);
            payload.push(0);
        }
        self.send(device_idx, CMD_UPDATE_LEDS, &payload).await
    }
}

// ── Controller data binary parser (protocol v1) ───────────────────────────────
//
// Format of the DATA field in a REQUEST_CONTROLLER_DATA reply:
//   u32  struct_size    (total bytes of what follows — skip)
//   u32  device_type
//   str  name           (u16 len including \0, then bytes)
//   str  vendor
//   str  description
//   str  version
//   str  serial
//   str  location
//   u16  num_modes
//     mode×:  str name, i32 value, u32 flags,
//             u32 speed_min, u32 speed_max,
//             u32 brightness_min, u32 brightness_max,   ← v2+
//             u32 colors_min, u32 colors_max,
//             u32 speed, u32 brightness,                ← v2+
//             u32 direction, u32 color_mode,
//             u16 num_colors, num_colors×u32 colors
//   u16  num_zones
//     zone×:  str name, u32 type,
//             u32 leds_min, u32 leds_max, u32 leds_count,
//             u16 matrix_height, u16 matrix_width, u16 matrix_len,  ← v3+
//             matrix_len bytes
//   u16  num_leds   ← what we need
//   led×:  str name, u32 value
//   u16  num_colors
//   num_colors×u32 colors
//   u32  active_mode

fn parse_controller_info(data: &[u8]) -> Result<(String, usize), String> {
    let mut c = Cur::new(data);

    c.skip_u32()?; // struct_size
    c.skip_u32()?; // device_type
    let name = c.read_str()?;
    c.read_str()?; // vendor
    c.read_str()?; // description
    c.read_str()?; // version
    c.read_str()?; // serial
    c.read_str()?; // location

    // Modes (protocol v3 — includes brightness fields)
    let num_modes = c.read_u16()? as usize;
    for _ in 0..num_modes {
        c.read_str()?;  // name
        c.skip(4)?;     // value (i32)
        c.skip(4)?;     // flags
        c.skip(4 * 2)?; // speed_min, speed_max
        c.skip(4 * 2)?; // brightness_min, brightness_max  ← v2+
        c.skip(4 * 2)?; // colors_min, colors_max
        c.skip(4)?;     // speed
        c.skip(4)?;     // brightness  ← v2+
        c.skip(4 * 2)?; // direction, color_mode
        let num_colors = c.read_u16()? as usize;
        c.skip(num_colors * 4)?;
    }

    // Zones
    let num_zones = c.read_u16()? as usize;
    for _ in 0..num_zones {
        c.read_str()?; // name
        c.skip(4)?; // type
        c.skip(4 * 3)?; // leds_min, leds_max, leds_count
        c.skip_u16()?; // matrix_height
        c.skip_u16()?; // matrix_width
        let matrix_len = c.read_u16()? as usize;
        c.skip(matrix_len)?;
    }

    let num_leds = c.read_u16()? as usize;
    Ok((name, num_leds))
}

// ── Cursor helper ─────────────────────────────────────────────────────────────

struct Cur<'a> {
    data: &'a [u8],
    pos: usize,
}

impl<'a> Cur<'a> {
    fn new(data: &'a [u8]) -> Self {
        Cur { data, pos: 0 }
    }

    fn check(&self, n: usize) -> Result<(), String> {
        if self.pos + n > self.data.len() {
            Err(format!(
                "parse overrun: need {} bytes at pos {}/{}",
                n,
                self.pos,
                self.data.len()
            ))
        } else {
            Ok(())
        }
    }

    fn skip(&mut self, n: usize) -> Result<(), String> {
        self.check(n)?;
        self.pos += n;
        Ok(())
    }

    fn skip_u16(&mut self) -> Result<(), String> {
        self.skip(2)
    }
    fn skip_u32(&mut self) -> Result<(), String> {
        self.skip(4)
    }

    fn read_u16(&mut self) -> Result<u16, String> {
        self.check(2)?;
        let v = u16::from_le_bytes(self.data[self.pos..self.pos + 2].try_into().unwrap());
        self.pos += 2;
        Ok(v)
    }

    /// Read a length-prefixed string.  The u16 length INCLUDES the null terminator.
    fn read_str(&mut self) -> Result<String, String> {
        let len = self.read_u16()? as usize;
        if len == 0 {
            return Ok(String::new());
        }
        self.check(len)?;
        let bytes = &self.data[self.pos..self.pos + len];
        self.pos += len;
        let end = len.saturating_sub(1); // strip null terminator
        Ok(String::from_utf8_lossy(&bytes[..end]).to_string())
    }
}
