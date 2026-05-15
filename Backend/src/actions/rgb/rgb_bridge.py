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
import colorsys
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



def _correct_jrainbow2(color):
    """
    Correction de couleur pour JRAINBOW2 (bloc pompe MSI CoreLiquid E240).

    Calibration empirique (raw-zone sans correction) :
      envoyer R (0°)   → affiche rose  (~330°)
      envoyer G (120°) → affiche orange (~30°)
      envoyer B (240°) → affiche vert   (120°)

    Correction : interpolation linéaire par morceaux de la teinte cible vers
    la teinte à envoyer, d'après les 3 ancres de calibration ci-dessus.
    """
    r, g, b = color.red, color.green, color.blue
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)

    if v < 0.01 or s < 0.01:
        return color  # noir / blanc : pas de correction de teinte

    # Ancres : (teinte_affichée, teinte_à_envoyer) en fractions 0–1
    D0, S0 = 330 / 360, 0 / 360    # rose   → envoyer R
    D1, S1 =  30 / 360, 120 / 360  # orange → envoyer G
    D2, S2 = 120 / 360, 240 / 360  # vert   → envoyer B

    if D1 <= h <= D2:               # segment orange→vert
        t = (h - D1) / (D2 - D1)
        h_out = S1 + t * (S2 - S1)
    elif D2 <= h <= D0:             # segment vert→rose
        t = (h - D2) / (D0 - D2)
        h_out = S2 + t * (1.0 - S2)
    else:                           # segment rose→orange (passe par 0)
        h_norm = (h - D0) % 1.0
        span   = (D1 - D0) % 1.0
        t      = h_norm / span
        h_out  = (S0 + t * S1) % 1.0

    nr, ng, nb = (round(x * 255) for x in colorsys.hsv_to_rgb(h_out, s, v))
    return RGBColor(nr, ng, nb)


def set_zone_color(zone, color):
    """Applique la couleur sur une zone, avec correction si nécessaire."""
    if zone.name == "JRAINBOW2":
        zone.set_color(_correct_jrainbow2(color))
    else:
        zone.set_color(color)


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
        set_zone_color(zone, color)


def cmd_set_color(r, g, b, device_id=None):
    client = connect()
    color = RGBColor(r, g, b)

    if device_id is None:
        for dev in client.devices:
            set_direct_color(dev, color)
    else:
        set_direct_color(client.devices[device_id], color)

    print(json.dumps({"success": True, "error": None}))


def cmd_raw_zone(device_id, zone_id, r, g, b):
    """Envoie une couleur brute sans aucune correction — pour calibration."""
    client = connect()
    client.devices[device_id].zones[zone_id].set_color(RGBColor(r, g, b))
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

        elif cmd == "raw-zone":
            if len(args) < 6:
                raise ValueError("raw-zone nécessite device_id zone_id r g b")
            cmd_raw_zone(int(args[1]), int(args[2]), int(args[3]), int(args[4]), int(args[5]))

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
