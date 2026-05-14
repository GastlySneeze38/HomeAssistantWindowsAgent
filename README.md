# HomeAssistantWindowsAgent
A windows agent for Home Assistant

Commande pour lancer Vite : npm run dev
Url api : http://127.0.0.1:3000/
Commande pour actualiser l'api en temp réel : cargo watch -x run -w src
lancer les deux avec run-dev.bat

Nouveaux endpoints apps (Bearer requis):
- GET  /apps          — liste les apps enregistrées
- POST /apps/add      — ajoute une app  { name, path, args? }
- POST /apps/delete   — supprime une app { name }
