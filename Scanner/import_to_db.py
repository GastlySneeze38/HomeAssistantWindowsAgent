"""
import_to_db.py
Reads Scanner/programs.json and upserts all entries into the
`apps` table of Backend/App.db, generating aliases and close_processes automatically.
"""

import json
import re
import sqlite3
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
JSON_PATH  = SCRIPT_DIR / "programs.json"
DB_PATH    = SCRIPT_DIR.parent / "Backend" / "App.db"


def make_aliases(name: str) -> str:
    """Generate comma-separated lowercase aliases from a program name."""
    aliases = set()

    base = name.lower()
    aliases.add(base)

    # No spaces version: "OBS Studio" → "obsstudio"
    no_spaces = re.sub(r"\s+", "", base)
    aliases.add(no_spaces)

    # First word only if multi-word: "OBS Studio" → "obs"
    first_word = base.split()[0]
    aliases.add(first_word)

    # Strip version/edition suffixes: "Opera GX Stable 131.0..." → "opera gx"
    stripped = re.sub(r"\s+\d[\d\.]+.*$", "", base).strip()
    aliases.add(stripped)
    aliases.add(re.sub(r"\s+", "", stripped))

    # Strip trailing "launcher", "client", "player" etc.
    short = re.sub(r"\s+(launcher|client|player|app|stable|community edition).*$", "", base).strip()
    aliases.add(short)
    aliases.add(re.sub(r"\s+", "", short))

    # Remove non-alphanumeric (except spaces): "Who's Your Daddy?!" → "whos your daddy"
    clean = re.sub(r"[^\w\s]", "", base).strip()
    aliases.add(clean)
    aliases.add(re.sub(r"\s+", "", clean))

    # Remove duplicates, empties, and entries that are just numbers
    result = sorted({a for a in aliases if a and not re.fullmatch(r"[\d\.]+", a)})
    return ",".join(result)


def make_close_processes(command: str) -> str:
    """Derive the process .exe name from the command path."""
    exe = Path(command).name  # e.g. "Discord.exe"
    processes = [exe]

    # Well-known multi-process apps
    extras = {
        "valorant.exe": ["VALORANT-Win64-Shipping.exe", "RiotClientServices.exe", "RiotClientCrashHandler.exe"],
        "riotclientservices.exe": ["RiotClientServices.exe", "RiotClientCrashHandler.exe"],
        "steam.exe": ["steam.exe", "steamwebhelper.exe"],
        "discord.exe": ["Discord.exe", "DiscordCrashHandler.exe"],
        "obs64.exe": ["obs64.exe", "obs32.exe"],
        "epicgameslauncher.exe": ["EpicGamesLauncher.exe", "EpicWebHelper.exe"],
        "apexlauncher.exe": ["r5apex.exe", "EasyAntiCheat.exe"],
    }

    key = exe.lower()
    if key in extras:
        processes = extras[key]

    return ",".join(processes)


def main():
    if not JSON_PATH.exists():
        print(f"[ERROR] {JSON_PATH} not found — run scan_programs.ps1 first.")
        return

    if not DB_PATH.exists():
        print(f"[ERROR] {DB_PATH} not found — start the backend at least once to create the DB.")
        return

    with open(JSON_PATH, encoding="utf-8-sig") as f:
        programs = json.load(f)

    conn = sqlite3.connect(DB_PATH)
    cur  = conn.cursor()

    # Ensure table and new columns exist
    cur.execute("""
        CREATE TABLE IF NOT EXISTS apps (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            name            TEXT NOT NULL UNIQUE,
            path            TEXT NOT NULL,
            args            TEXT,
            aliases         TEXT,
            close_processes TEXT
        )
    """)
    for col in ("aliases", "close_processes"):
        try:
            cur.execute(f"ALTER TABLE apps ADD COLUMN {col} TEXT")
        except sqlite3.OperationalError:
            pass  # column already exists

    # Drop the old programs table created by a previous version of this script
    cur.execute("DROP TABLE IF EXISTS programs")

    inserted = 0
    updated  = 0

    for p in programs:
        name            = p["name"].strip()
        command         = p["command"].strip()
        aliases         = make_aliases(name)
        close_processes = make_close_processes(command)

        cur.execute("SELECT id, path, aliases, close_processes FROM apps WHERE name = ?", (name,))
        row = cur.fetchone()

        if row is None:
            cur.execute(
                "INSERT INTO apps (name, path, aliases, close_processes) VALUES (?, ?, ?, ?)",
                (name, command, aliases, close_processes),
            )
            inserted += 1
        else:
            cur.execute(
                "UPDATE apps SET path = ?, aliases = ?, close_processes = ? WHERE name = ?",
                (command, aliases, close_processes, name),
            )
            updated += 1

    conn.commit()
    conn.close()

    print(f"Done — {inserted} inserted, {updated} updated ({len(programs)} total in JSON).")
    print(f"DB: {DB_PATH}")


if __name__ == "__main__":
    main()
