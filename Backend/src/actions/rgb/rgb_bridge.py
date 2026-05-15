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
        devices.append({
            "id": i,
            "name": dev.name,
            "led_count": len(dev.leds),
        })
    print(json.dumps(devices))


def cmd_set_color(r, g, b, device_id=None):
    client = connect()
    color = RGBColor(r, g, b)

    if device_id is None:
        # Tous les devices
        for dev in client.devices:
            if len(dev.leds) > 0:
                dev.set_color(color)
    else:
        dev = client.devices[device_id]
        if len(dev.leds) > 0:
            dev.set_color(color)

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
