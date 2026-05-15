export type KnownGame = {
  name: string;
  process: string;
  category: string;
};

export const KNOWN_GAMES: KnownGame[] = [
  // ── FPS / Tir ──────────────────────────────────────────────────────────────
  { name: 'Valorant',               process: 'VALORANT-Win64-Shipping.exe', category: 'FPS' },
  { name: 'Counter-Strike 2',       process: 'cs2.exe',                     category: 'FPS' },
  { name: 'Fortnite',               process: 'FortniteClient-Win64-Shipping.exe', category: 'FPS' },
  { name: 'Apex Legends',           process: 'r5apex.exe',                  category: 'FPS' },
  { name: 'Overwatch 2',            process: 'Overwatch.exe',               category: 'FPS' },
  { name: 'Call of Duty: Warzone',  process: 'cod.exe',                     category: 'FPS' },
  { name: 'Call of Duty: MW3',      process: 'cod.exe',                     category: 'FPS' },
  { name: 'Rainbow Six Siege',      process: 'RainbowSix.exe',              category: 'FPS' },
  { name: 'Battlefield 2042',       process: 'BF2042.exe',                  category: 'FPS' },
  { name: 'Escape from Tarkov',     process: 'EscapeFromTarkov.exe',        category: 'FPS' },
  { name: 'Hunt: Showdown',         process: 'HuntGame.exe',                category: 'FPS' },
  { name: 'The Finals',             process: 'Discovery.exe',               category: 'FPS' },
  { name: 'XDefiant',               process: 'XDefiant.exe',                category: 'FPS' },

  // ── MOBA / Strategy ────────────────────────────────────────────────────────
  { name: 'League of Legends',      process: 'League of Legends.exe',       category: 'MOBA' },
  { name: 'DOTA 2',                 process: 'dota2.exe',                   category: 'MOBA' },
  { name: 'Smite 2',                process: 'Smite2.exe',                  category: 'MOBA' },

  // ── MMO / RPG ──────────────────────────────────────────────────────────────
  { name: 'World of Warcraft',      process: 'Wow.exe',                     category: 'MMO' },
  { name: 'Final Fantasy XIV',      process: 'ffxiv_dx11.exe',              category: 'MMO' },
  { name: 'Lost Ark',               process: 'LOSTARK.exe',                 category: 'MMO' },
  { name: 'New World',              process: 'NewWorld.exe',                category: 'MMO' },
  { name: 'Throne and Liberty',     process: 'TNLEU.exe',                   category: 'MMO' },
  { name: 'Path of Exile 2',        process: 'PathOfExile.exe',             category: 'RPG' },
  { name: 'Diablo IV',              process: 'Diablo IV.exe',               category: 'RPG' },
  { name: 'Baldur\'s Gate 3',       process: 'bg3.exe',                     category: 'RPG' },
  { name: 'Cyberpunk 2077',         process: 'Cyberpunk2077.exe',           category: 'RPG' },
  { name: 'Elden Ring',             process: 'eldenring.exe',               category: 'RPG' },
  { name: 'Hogwarts Legacy',        process: 'HogwartsLegacy.exe',          category: 'RPG' },
  { name: 'Starfield',              process: 'Starfield.exe',               category: 'RPG' },
  { name: 'The Witcher 3',          process: 'witcher3.exe',                category: 'RPG' },

  // ── Battle Royale / Survie ─────────────────────────────────────────────────
  { name: 'PUBG',                   process: 'TslGame.exe',                 category: 'Battle Royale' },
  { name: 'Rust',                   process: 'rust.exe',                    category: 'Survie' },
  { name: 'DayZ',                   process: 'DayZ_x64.exe',               category: 'Survie' },
  { name: 'Palworld',               process: 'Palworld.exe',                category: 'Survie' },
  { name: 'ARK: Survival Ascended', process: 'ArkAscended.exe',            category: 'Survie' },
  { name: 'Minecraft',              process: 'javaw.exe',                   category: 'Survie' },
  { name: 'Terraria',               process: 'Terraria.exe',                category: 'Survie' },

  // ── Sport / Course ─────────────────────────────────────────────────────────
  { name: 'EA FC 25',               process: 'FC25.exe',                    category: 'Sport' },
  { name: 'Rocket League',          process: 'RocketLeague.exe',            category: 'Sport' },
  { name: 'F1 24',                  process: 'F1_24.exe',                   category: 'Course' },
  { name: 'Forza Horizon 5',        process: 'ForzaHorizon5.exe',          category: 'Course' },
  { name: 'Gran Turismo 7',         process: 'GT7.exe',                     category: 'Course' },
  { name: 'iRacing',                process: 'iRacingSim64DX11.exe',        category: 'Course' },
  { name: 'Assetto Corsa Competizione', process: 'AC2.exe',                category: 'Course' },

  // ── Action / Aventure ──────────────────────────────────────────────────────
  { name: 'GTA V',                  process: 'GTA5.exe',                    category: 'Action' },
  { name: 'Red Dead Redemption 2',  process: 'RDR2.exe',                    category: 'Action' },
  { name: 'Assassin\'s Creed Shadows', process: 'ACValhalla.exe',          category: 'Action' },
  { name: 'Spider-Man 2',           process: 'Spider-Man2.exe',             category: 'Action' },
  { name: 'God of War',             process: 'GoW.exe',                     category: 'Action' },
  { name: 'Hades II',               process: 'Hades2.exe',                  category: 'Roguelike' },
  { name: 'Dead Cells',             process: 'deadcells.exe',               category: 'Roguelike' },

  // ── Simulateurs ────────────────────────────────────────────────────────────
  { name: 'Microsoft Flight Simulator 2024', process: 'FlightSimulator.exe', category: 'Simulation' },
  { name: 'Euro Truck Simulator 2', process: 'eurotrucks2.exe',             category: 'Simulation' },
  { name: 'American Truck Simulator', process: 'amtrucks.exe',              category: 'Simulation' },
  { name: 'Cities: Skylines II',    process: 'Cities2.exe',                 category: 'Simulation' },

  // ── Streamer / Autre ───────────────────────────────────────────────────────
  { name: 'VRChat',                 process: 'VRChat.exe',                  category: 'Social' },
  { name: 'Phasmophobia',           process: 'Phasmophobia.exe',            category: 'Horreur' },
  { name: 'Lethal Company',         process: 'Lethal Company.exe',          category: 'Horreur' },
];

export const CATEGORIES = [...new Set(KNOWN_GAMES.map(g => g.category))].sort();
