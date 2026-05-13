# HomeAssistantWindowsAgent
A windows agent for Home Assistant

Commande pour lancer Vite : npm run dev
Url api : http://127.0.0.1:3000/
Commande pour actualiser l'api en temp réel : cargo watch -x run -w src
lancer les deux avec run-dev.bat

TODO: 
-relier l'historique selon l'uuid qui l'a executer
-modifier l'interface utilisateur
-ajouter websoket pour plutard ( l'utiliser pour la ram dispo )
-supprimer l'utilisateur de base automatiquement quand tu creer un premier nouvelle utilisateur
-Ajouter des Application pour le démarage d'app
-Corriger la fermeture des processus pour une compatibilité plus importante
-ajouter les fonctionnalité principale : 
    * Fermer une application
    * Activer/désactiver Bluetooth et wifi
    * Voir l’état du PC (CPU, température)
    * Notifications quand quelqu’un utilise le PC
    * Lancer une application ( a dev pour prendre plus d'app )
