mod handlers;
mod launcher;
mod close;
mod system;

use tower_http::cors::{CorsLayer, Any};
use axum::{routing::{get, post}, Router};
use std::net::SocketAddr;

#[tokio::main]
async fn main() {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/health", get(handlers::health_handler))
        .route("/system", get(handlers::system_handler))
        .route("/launch", post(handlers::launch_handler))
        .route("/close", post(handlers::close_handler))
        .layer(cors);

    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    println!("Listening on http://{}", addr);

    axum::serve(
        tokio::net::TcpListener::bind(addr).await.unwrap(),
        app,
    )
    .await
    .unwrap();
}