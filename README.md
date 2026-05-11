# HomeAssistantWindowsAgent
A windows agent for Home Assistant

Commande pour lancer Vite : npm run dev
Url api : http://127.0.0.1:3000/
Commande pour actualiser l'api en temp réel : cargo watch -x run -w src
lancer les deux avec run-dev.bat

TODO: 
-optimiser les token pour ne pas encombrer la db
-enlever les warning de compilation et enlever le code mort
-rajouter l'interface d'historique de démmarage
-Ajouter des Application pour le démarage d'app
-Corriger la fermeture des processus pour une compatibilité plus importante
-ajouter les fonctionnalité principale : 
    * Fermer une application
    * Activer/désactiver Bluetooth et wifi
    * Voir l’état du PC (CPU, température)
    * Notifications quand quelqu’un utilise le PC
    * Lancer une application ( a dev pour prendre plus d'app )
