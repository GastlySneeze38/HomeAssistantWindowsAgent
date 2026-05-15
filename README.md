-ajouter la consomation du pc si possible

# HomeAssistant Windows Agent

Agent Windows contrôlable à distance via une API locale. Permet à Home Assistant (ou n'importe quel client HTTP) de piloter un PC Windows : lancer des programmes, surveiller les ressources, automatiser des actions selon le jeu détecté.

---

## Architecture

| Partie | Technologie | Port |
|---|---|---|
| Backend (API) | Rust · Axum | 3000 |
| Frontend (UI) | Electron · React · TypeScript | 5173 (dev) |

---

## Fonctionnalités

### Dashboard — Surveillance système en temps réel
- CPU : usage %, fréquence, nombre de cœurs, température
- RAM : total, utilisée, disponible
- GPU : usage %, VRAM, température (si disponible)
- Réseau : débit montant/descendant par interface
- Uptime du PC
- Fenêtres actives

Données envoyées en push via WebSocket toutes les secondes.

### Contrôle — Lancer / fermer des programmes
- Lancer une application par commande ou depuis la liste des apps installées
- Fermer un processus par son nom
- Historique des 100 dernières actions par utilisateur

### YouTube Music — Contrôle de playlists
- Enregistrer des playlists YouTube avec un nom
- Lancer une playlist dans Microsoft Edge
- Les playlists sauvegardées sont utilisables dans les profils d'automatisation

### Automatisation par jeu — Profils de lancement
Détection automatique (toutes les 3 s) du processus actif. Quand un jeu est détecté, le profil associé déclenche :

- **RGB** — Changer la couleur de tous les périphériques OpenRGB (MSI, etc.) à une couleur définie
- **YouTube Music** — Lancer automatiquement une playlist
- **Discord — Salon vocal** — Rejoindre un salon vocal d'un serveur Discord
- **Discord — Message** — Envoyer un message automatique dans un salon texte (avec support de mentions @rôle et @membre)

Chaque profil est lié à un jeu installé (détection via le nom du processus `.exe`). Les profils peuvent être activés/désactivés individuellement.

### Utilisateurs
- Création et suppression de comptes
- Authentification par token Bearer (validité 7 jours)
- Wizard de configuration au premier lancement (suppression du compte `admin` par défaut)

---

## Lancer le projet

```bat
run-dev.bat
```

Lance les deux services dans des terminaux séparés avec hot-reload.

### Séparément

```bash
# Backend
cd Backend
cargo run

# Frontend
cd Frontend
npm install
npm run dev
```

---

## API

L'API écoute sur `127.0.0.1:3000` (non exposée sur le réseau).

| Méthode | Route | Auth | Description |
|---|---|---|---|
| GET | `/health` | Non | Vérification de vie |
| GET | `/setup/status` | Non | Vérifie si le setup initial est fait |
| POST | `/setup/finalize` | Bearer | Finalise le setup (supprime admin) |
| POST | `/login` | Non | Retourne un token Bearer |
| POST | `/logout` | Bearer | Invalide le token |
| GET | `/system` | Bearer | RAM disponible |
| GET | `/ws` | `?token=` | WebSocket — push dashboard toutes les secondes |
| POST | `/launch` | Bearer | Lance un programme |
| POST | `/close` | Bearer | Ferme un processus |
| GET | `/history` | Bearer | 100 dernières actions |
| POST | `/create_user` | Bearer | Crée un utilisateur |
| POST | `/delete_user` | Bearer | Supprime un utilisateur |
| GET | `/apps` | Bearer | Liste des apps installées |
| GET | `/automation/profiles` | Bearer | Liste des profils d'automatisation |
| POST | `/automation/profiles/add` | Bearer | Crée un profil |
| POST | `/automation/profiles/update` | Bearer | Modifie un profil |
| POST | `/automation/profiles/delete` | Bearer | Supprime un profil |
| GET | `/youtube/playlists` | Bearer | Liste des playlists sauvegardées |
| GET | `/discord/roles` | Bearer | Rôles Discord configurés |
| GET | `/discord/members` | Bearer | Membres Discord configurés |

---

## Scanner les programmes installés

Pour mettre à jour la liste des apps disponibles dans l'interface :

```powershell
Scanner/scan_programs.ps1   # scan du registre Windows
python Scanner/import_to_db.py  # import dans la base SQLite
```

---

## Base de données

SQLite — fichier `Backend/App.db` créé automatiquement au premier lancement.

Tables : `users`, `tokens`, `history`, `apps`, `game_profiles`, `youtube_playlists`, `discord_roles`, `discord_members`.
