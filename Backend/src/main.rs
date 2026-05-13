mod close;
mod database;
mod handlers;
mod launcher;
mod system;
mod auth;
mod init;
mod middleware;
mod ws;

use axum::{
    routing::{get, post},
    Router,
};
use database::Database;
use std::{net::SocketAddr, sync::Arc};
use tower_http::cors::{Any, CorsLayer};

#[tokio::main]
async fn main() {
    let db = Arc::new(Database::new().expect("Falha ao inicializar banco de dados"));
    
    // Initialiser les utilisateurs par défaut
    init::init_default_user(&db);

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/health", get(handlers::health_handler))
        .route("/setup/status", get(handlers::setup_status_handler))
        .route("/setup/finalize", post(handlers::setup_finalize_handler))
        .route("/system", get(handlers::system_handler))
        .route("/launch", post(handlers::launch_handler))
        .route("/close", post(handlers::close_handler))
        .route("/history", get(handlers::history_handler))
        .route("/login", post(handlers::login_handler))
        .route("/logout", post(handlers::logout_handler))
        .route("/create_user", post(handlers::handle_create_user))
        .route("/delete_user", post(handlers::handle_delete_user))
        .route("/ws", get(ws::ws_handler))
        .layer(cors)
        .with_state(db);

    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    println!("Listening on http://{}", addr);

    axum::serve(
        tokio::net::TcpListener::bind(addr).await.unwrap(),
        app,
    )
    .await
    .unwrap();
}