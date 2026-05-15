use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Deserialize, Clone, Debug)]
pub struct PlayPlaylistRequest {
    pub playlist_id: String,
}

#[derive(Serialize)]
pub struct YoutubeResponse {
    pub success: bool,
    pub error: Option<String>,
}

pub fn play_playlist(request: PlayPlaylistRequest) -> YoutubeResponse {
    let url = format!(
        "https://music.youtube.com/playlist?list={}",
        request.playlist_id
    );

    let result = Command::new("cmd")
        .args(["/C", "start", "", &url])
        .spawn();

    match result {
        Ok(_) => YoutubeResponse { success: true, error: None },
        Err(e) => YoutubeResponse { success: false, error: Some(e.to_string()) },
    }
}
