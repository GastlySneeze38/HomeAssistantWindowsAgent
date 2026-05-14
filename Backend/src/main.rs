mod actions;
mod api;
mod core;
mod monitoring;

use actions::openrgb_manager::OpenRgbManager;
use axum::{
    routing::{get, post},
    Router,
};
use core::database::Database;
use std::{net::SocketAddr, sync::Arc};
use tower_http::cors::{Any, CorsLayer};

#[tokio::main]
async fn main() {
    let db = Arc::new(Database::new().expect("Falha ao inicializar banco de dados"));
    core::init::init_default_user(&db);

    // Start OpenRGB headless server (downloads automatically if missing)
    let openrgb = Arc::new(OpenRgbManager::new());
    openrgb.start().await;

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/health", get(api::handlers::health_handler))
        .route("/setup/status", get(api::handlers::setup_status_handler))
        .route("/setup/finalize", post(api::handlers::setup_finalize_handler))
        .route("/launch", post(api::handlers::launch_handler))
        .route("/close", post(api::handlers::close_handler))
        .route("/history", get(api::handlers::history_handler))
        .route("/login", post(api::handlers::login_handler))
        .route("/logout", post(api::handlers::logout_handler))
        .route("/create_user", post(api::handlers::handle_create_user))
        .route("/delete_user", post(api::handlers::handle_delete_user))
        .route("/apps", get(api::handlers::get_apps_handler))
        .route("/apps/add", post(api::handlers::add_app_handler))
        .route("/apps/delete", post(api::handlers::delete_app_handler))
        .route("/rgb/devices", get(api::handlers::rgb_devices_handler))
        .route("/rgb/color", post(api::handlers::rgb_color_handler))
        .route("/rgb/off", post(api::handlers::rgb_off_handler))
        .route("/ws", get(monitoring::ws::ws_handler))
        .layer(cors)
        .with_state(db);

    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    println!("Listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();

    axum::serve(listener, app)
        .with_graceful_shutdown(async move {
            tokio::signal::ctrl_c().await.ok();
            openrgb.stop().await;
        })
        .await
        .unwrap();
}
