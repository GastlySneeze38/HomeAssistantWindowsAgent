# HomeAssistantWindowsAgent
A windows agent for Home Assistant

Commande pour lancer Vite : npm run dev
Url api : http://127.0.0.1:3000/
Commande pour actualiser l'api en temp réel : cargo watch -x run -w src
lancer les deux avec run-dev.bat

TODO: 
-envoyer a la page de login si l'utilisateur a un token non valid ( err 401 ) avec fetchapi
-optimiser les token pour ne pas encombrer la db retirer l'uuid quand la personne quitte l'app ou qu'il se déconnecte
-ajouter de quoi ajouter un utilisateur et faire supprimer l'utilisateur de base automatiquement
-rajouter l'interface d'historique d'action et le relier selon l'uuid qui l'a executer
-Ajouter des Application pour le démarage d'app
-Corriger la fermeture des processus pour une compatibilité plus importante
-ajouter les fonctionnalité principale : 
    * Fermer une application
    * Activer/désactiver Bluetooth et wifi
    * Voir l’état du PC (CPU, température)
    * Notifications quand quelqu’un utilise le PC
    * Lancer une application ( a dev pour prendre plus d'app )
