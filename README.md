# HomeAssistantWindowsAgent
A windows agent for Home Assistant

Commande pour lancer Vite : npm run dev
Url api : http://127.0.0.1:3000/
Commande pour actualiser l'api en temp réel : cargo watch -x run -w src
lancer les deux avec run-dev.bat

corriger le rgb avec l'erreur : 
[RGB][client] Connexion à OpenRGB sur 127.0.0.1:6742...
[RGB][client] Connexion TCP établie
[RGB][client] Nom du client envoyé
[RGB][client] Serveur : v5 — on avait demandé v3 → version effective : v3
[RGB][client] 3 contrôleur(s) détecté(s)
[RGB] Récupération de 3 contrôleur(s)...
[RGB][client] Contrôleur 0 : payload reçu (1083 octets), parsing avec protocole v3...
[RGB][parser] Contrôleur : 'MSI GeForce RTX 4060 Gaming X' (pos après nom = 40)
[RGB][parser] 'MSI GeForce RTX 4060 Gaming X' — strings lues, pos = 133
[RGB][parser] 'MSI GeForce RTX 4060 Gaming X' — 0 modes, mode actif = 0
[RGB][parser] 'MSI GeForce RTX 4060 Gaming X' — octets[139..155] avant modes : [00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 01, 00, 00, 00, 00, 00]
[RGB][parser] 'MSI GeForce RTX 4060 Gaming X' — modes traités, pos = 139
[RGB][parser] 'MSI GeForce RTX 4060 Gaming X' — 0 zones
[RGB][parser] 'MSI GeForce RTX 4060 Gaming X' — zones traitées, pos = 141
[RGB][parser] 'MSI GeForce RTX 4060 Gaming X' — 0 LEDs ✓  (pos = 143)
[RGB] Contrôleur 0 : 'MSI GeForce RTX 4060 Gaming X' (0 LEDs) ✓
[RGB][client] Contrôleur 1 : payload reçu (584 octets), parsing avec protocole v3...
[RGB][parser] Contrôleur : 'G502 LIGHTSPEED Wireless Gaming Mouse' (pos après nom = 48)
[RGB][parser] 'G502 LIGHTSPEED Wireless Gaming Mouse' — strings lues, pos = 232
[RGB][parser] 'G502 LIGHTSPEED Wireless Gaming Mouse' — 20224 modes, mode actif = 26214
[RGB][parser] 'G502 LIGHTSPEED Wireless Gaming Mouse' — octets[238..254] avant modes : [00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00]
[RGB][parser] 'G502 LIGHTSPEED Wireless Gaming Mouse' mode[0]='' flags=0x00000000 colors=32 (début=238 fin=418)
[RGB][parser] 'G502 LIGHTSPEED Wireless Gaming Mouse' mode[1]='' flags=0x7242000a colors=1 (début=418 fin=474)
' flags=0x20797261 colors=0 (début=474 fin=528)Mouse' mode[2]='
[RGB] ⚠️  Contrôleur 1 : impossible de parser — parse error at byte 530: champ 'mode.name' : besoin de 256 octet(s) à pos 530, mais il n'en reste que 54 (total = 584). Ce contrôleur sera retourné avec led_count=0.
[RGB][client] Contrôleur 2 : payload reçu (1648 octets), parsing avec protocole v3...
[RGB][parser] Contrôleur : 'MSI MPG B550 GAMING PLUS (MS-7C56)' (pos après nom = 45)
[RGB][parser] 'MSI MPG B550 GAMING PLUS (MS-7C56)' — strings lues, pos = 230
[RGB][parser] 'MSI MPG B550 GAMING PLUS (MS-7C56)' — 0 modes, mode actif = 0
[RGB][parser] 'MSI MPG B550 GAMING PLUS (MS-7C56)' — octets[236..252] avant modes : [00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00]
[RGB][parser] 'MSI MPG B550 GAMING PLUS (MS-7C56)' — modes traités, pos = 236
[RGB][parser] 'MSI MPG B550 GAMING PLUS (MS-7C56)' — 0 zones
[RGB][parser] 'MSI MPG B550 GAMING PLUS (MS-7C56)' — zones traitées, pos = 238
[RGB][parser] 'MSI MPG B550 GAMING PLUS (MS-7C56)' — 0 LEDs ✓  (pos = 240)
[RGB] Contrôleur 2 : 'MSI MPG B550 GAMING PLUS (MS-7C56)' (0 LEDs) ✓
[RGB] 0/3 contrôleur(s) parsé(s) avec succès
[NetworkServer] recv_select failed receiving magic, closing listener
[RGB][client] Connexion à OpenRGB sur 127.0.0.1:6742...
[RGB][client] Connexion TCP établie
[RGB][client] Nom du client envoyé
[RGB][client] Serveur : v5 — on avait demandé v3 → version effective : v3
[RGB][client] 3 contrôleur(s) détecté(s)
[RGB] Récupération de 3 contrôleur(s)...
[RGB][client] Contrôleur 0 : payload reçu (1083 octets), parsing avec protocole v3...
[RGB][parser] Contrôleur : 'MSI GeForce RTX 4060 Gaming X' (pos après nom = 40)
[RGB][parser] 'MSI GeForce RTX 4060 Gaming X' — strings lues, pos = 133
[RGB][parser] 'MSI GeForce RTX 4060 Gaming X' — 0 modes, mode actif = 0
[RGB][parser] 'MSI GeForce RTX 4060 Gaming X' — octets[139..155] avant modes : [00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 01, 00, 00, 00, 00, 00]
[RGB][parser] 'MSI GeForce RTX 4060 Gaming X' — modes traités, pos = 139
[RGB][parser] 'MSI GeForce RTX 4060 Gaming X' — 0 zones
[RGB][parser] 'MSI GeForce RTX 4060 Gaming X' — zones traitées, pos = 141
[RGB][parser] 'MSI GeForce RTX 4060 Gaming X' — 0 LEDs ✓  (pos = 143)
[RGB] Contrôleur 0 : 'MSI GeForce RTX 4060 Gaming X' (0 LEDs) ✓
[RGB][client] Contrôleur 1 : payload reçu (584 octets), parsing avec protocole v3...
[RGB][parser] Contrôleur : 'G502 LIGHTSPEED Wireless Gaming Mouse' (pos après nom = 48)
[RGB][parser] 'G502 LIGHTSPEED Wireless Gaming Mouse' — strings lues, pos = 232
[RGB][parser] 'G502 LIGHTSPEED Wireless Gaming Mouse' — 20224 modes, mode actif = 26214
[RGB][parser] 'G502 LIGHTSPEED Wireless Gaming Mouse' — octets[238..254] avant modes : [00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00]
[RGB][parser] 'G502 LIGHTSPEED Wireless Gaming Mouse' mode[0]='' flags=0x00000000 colors=32 (début=238 fin=418)
[RGB][parser] 'G502 LIGHTSPEED Wireless Gaming Mouse' mode[1]='' flags=0x7242000a colors=1 (début=418 fin=474)
' flags=0x20797261 colors=0 (début=474 fin=528)Mouse' mode[2]='
[RGB] ⚠️  Contrôleur 1 : impossible de parser — parse error at byte 530: champ 'mode.name' : besoin de 256 octet(s) à pos 530, mais il n'en reste que 54 (total = 584). Ce contrôleur sera retourné avec led_count=0.
[RGB][client] Contrôleur 2 : payload reçu (1648 octets), parsing avec protocole v3...
[RGB][parser] Contrôleur : 'MSI MPG B550 GAMING PLUS (MS-7C56)' (pos après nom = 45)
[RGB][parser] 'MSI MPG B550 GAMING PLUS (MS-7C56)' — strings lues, pos = 230
[RGB][parser] 'MSI MPG B550 GAMING PLUS (MS-7C56)' — 0 modes, mode actif = 0
[RGB][parser] 'MSI MPG B550 GAMING PLUS (MS-7C56)' — octets[236..252] avant modes : [00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00]
[RGB][parser] 'MSI MPG B550 GAMING PLUS (MS-7C56)' — modes traités, pos = 236
[RGB][parser] 'MSI MPG B550 GAMING PLUS (MS-7C56)' — 0 zones
[RGB][parser] 'MSI MPG B550 GAMING PLUS (MS-7C56)' — zones traitées, pos = 238
[RGB][parser] 'MSI MPG B550 GAMING PLUS (MS-7C56)' — 0 LEDs ✓  (pos = 240)
[RGB] Contrôleur 2 : 'MSI MPG B550 GAMING PLUS (MS-7C56)' (0 LEDs) ✓
[RGB] 0/3 contrôleur(s) parsé(s) avec succès

Automatisation :
-RGB -> OpenRGB pour MSI ( on le télécharge, lance et ferme avec l'app )
-Discord -> TODO: ajouter un controle des action dans discord pour l'automatisation
-Valorant -> Déja en place, juste le relier avec les autre
-Musique -> Controler Microsoft Edge pour lancer playlist
-Profil par jeux -> Gérer les app qui se lance selon l'actioneur