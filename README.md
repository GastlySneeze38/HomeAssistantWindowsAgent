# HomeAssistantWindowsAgent
A windows agent for Home Assistant

Commande pour lancer Vite : npm run dev
Url api : http://127.0.0.1:3000/
Commande pour actualiser l'api en temp réel : cargo watch -x run -w src

TODO: 
-Connecter l'api Rust correctement
-Corriger le lancement d'application
-ajouter les fonctionnalité principale : 
    * Lancer une application
    * Fermer une application
    * Activer/désactiver Bluetooth et wifi
    * Voir l’état du PC (CPU, RAM, température)
    * Notifications quand quelqu’un utilise le PC
