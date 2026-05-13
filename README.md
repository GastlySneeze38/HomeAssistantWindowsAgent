# HomeAssistantWindowsAgent
A windows agent for Home Assistant

Commande pour lancer Vite : npm run dev
Url api : http://127.0.0.1:3000/
Commande pour actualiser l'api en temp réel : cargo watch -x run -w src
lancer les deux avec run-dev.bat

Structure pour dashboard final du pc en WS : 
Rust Backend (Axum)
        │
        ├── sysinfo
        │     CPU
        │     RAM
        │     Réseau
        │     Disques
        │     Processus
        │     Uptime
        │
        ├── nvml-wrapper
        │     GPU NVIDIA
        │     VRAM
        │     Température GPU
        │
        ├── LibreHardwareMonitor
        │     Température CPU
        │     Carte mère
        │     Capteurs hardware
        │
        ├── windows-rs
        │     Win32 API
        │     DXGI
        │     Process API
        │     Fenêtres Windows
        │     FPS Desktop
        │
        └── tokio
              tâches async
              refresh monitoring
              websocket temps réel

TODO: 
-Corriger la fermeture des processus pour une compatibilité plus importante
-Ajouter des Application pour le démarage d'app
-ajouter les fonctionnalité principale : 
    * Fermer une application
    * Activer/désactiver Bluetooth et wifi
    * Voir l’état du PC (CPU, température)
    * Notifications quand quelqu’un utilise le PC
    * Lancer une application ( a dev pour prendre plus d'app )
