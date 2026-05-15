"""
Pont entre Rust et l'API officielle openrgb-python.

Usage :
  python rgb_bridge.py get-devices
  python rgb_bridge.py set-color <r> <g> <b>
  python rgb_bridge.py set-color <r> <g> <b> <device_id>
  python rgb_bridge.py turn-off
  python rgb_bridge.py turn-off <device_id>

Toutes les sorties sont en JSON sur stdout.
Les erreurs sont aussi en JSON : {"success": false, "error": "..."}
"""

import sys
import json
from openrgb import OpenRGBClient
from openrgb.utils import RGBColor


def connect():
    """Connexion à OpenRGB sur le port SDK par défaut (6742)."""
    return OpenRGBClient()


def cmd_get_devices():
    client = connect()
    devices = []
    for i, dev in enumerate(client.devices):
        zones = []
        for j, zone in enumerate(dev.zones):
            zones.append({
                "id": j,
                "name": zone.name,
                "led_count": len(zone.leds),
            })
        devices.append({
            "id": i,
            "name": dev.name,
            "led_count": len(dev.leds),
            "modes": [m.name for m in dev.modes],
            "active_mode": dev.active_mode,
            "zones": zones,
        })
    print(json.dumps(devices))


def set_direct_color(dev, color):
    """
    Applique une couleur fixe zone par zone, en ignorant les zones vides.

    Les zones avec 0 LEDs (ex: headers JRAINBOW avec un watercooling AIO branché)
    ne reçoivent aucune donnée pour ne pas perturber le firmware du pompe AIO.
    Appliquer set_color() sur tout le device enverrait des données sur ces ports
    et éteindrait le watercooling.

    Ordre de préférence pour le mode :
      1. "Static"  — couleur fixe, compatible avec les devices mixtes
      2. "Direct"  — contrôle temps réel (peut éteindre certains AIO)
      3. Aucun changement — on tente quand même zone par zone
    """
    active_zones = [z for z in dev.zones if len(z.leds) > 0]
    if not active_zones:
        return

    mode_names = [m.name.lower() for m in dev.modes]
    current_mode = mode_names[dev.active_mode] if dev.modes else ""

    # Ne changer le mode que si nécessaire : changer le mode sur le device entier
    # réinitialise TOUS les headers (y compris JRAINBOW avec watercooling AIO),
    # ce qui éteint les LEDs du watercooling même si on ne touche pas à ces zones.
    if current_mode not in ("static", "direct"):
        if "static" in mode_names:
            dev.set_mode(mode_names.index("static"))
        elif "direct" in mode_names:
            dev.set_mode(mode_names.index("direct"))

    # Couleur zone par zone : on ne touche pas les zones vides (watercooling)
    for zone in active_zones:
        zone.set_color(color)


def cmd_set_color(r, g, b, device_id=None):
    client = connect()
    color = RGBColor(r, g, b)

    if device_id is None:
        for dev in client.devices:
            set_direct_color(dev, color)
    else:
        set_direct_color(client.devices[device_id], color)

    print(json.dumps({"success": True, "error": None}))


def cmd_resize_zone(device_id, zone_id, size):
    client = connect()
    client.devices[device_id].zones[zone_id].resize(size)
    print(json.dumps({"success": True, "error": None}))


def main():
    args = sys.argv[1:]

    if not args:
        print(json.dumps({"success": False, "error": "Aucune commande fournie"}))
        sys.exit(1)

    cmd = args[0]

    try:
        if cmd == "get-devices":
            cmd_get_devices()

        elif cmd == "resize-zone":
            if len(args) < 4:
                raise ValueError("resize-zone nécessite device_id zone_id size")
            cmd_resize_zone(int(args[1]), int(args[2]), int(args[3]))

        elif cmd == "set-color":
            if len(args) < 4:
                raise ValueError("set-color nécessite r g b")
            r, g, b = int(args[1]), int(args[2]), int(args[3])
            device_id = int(args[4]) if len(args) >= 5 else None
            cmd_set_color(r, g, b, device_id)

        elif cmd == "turn-off":
            device_id = int(args[1]) if len(args) >= 2 else None
            cmd_set_color(0, 0, 0, device_id)

        else:
            raise ValueError(f"Commande inconnue : {cmd}")

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
