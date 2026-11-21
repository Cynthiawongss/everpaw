# EverPaw Home

A small 3D home for a pet: a room you furnish, and a companion who lives in it, eats, drinks, plays, naps on the window seat and answers when you call. Made for remembering a pet who has died, and equally for keeping a new one.

Live: https://cynthiawongss.com/everpaw/

## What is here

- `index.html`, `app.js`, `ui.css`, `data.js`, `sound.js` — the app: interface, saved state (in the browser), English and Chinese text, synthesised sound.
- `world.js` — the 3D engine: camera, pets and their behaviour, furniture, decorating on a grid.
- `rooms/` — three original rooms (window seat, attic, glasshouse), each a model plus one baked light texture for day, evening and night.
- `tools/build_rooms.py` — the Blender script that models the rooms and bakes their light.
- `three/` — three.js r160 (MIT, see `three/LICENSE`).

## Run it locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000/.

## Rebuild the rooms

Needs Blender 4.5 LTS.

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --python tools/build_rooms.py -- rooms bay attic glass
```

## Status

Everything is stored in the browser on the device. Checkout is a test screen: no payment provider is connected and nothing is charged.
