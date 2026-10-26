# 06 - Testing offline, on the laptop and on a phone

## Short answer: no APK is needed

Warehouse Operations Copilot is a web app. All AI (QVAC) runs inside the app's server on the **laptop**, on its CPU. A browser is just the screen. That gives three ways to test it offline:

| Option | What it is | Use it for |
|---|---|---|
| **A. Laptop only (recommended)** | Server and browser on the laptop, Wi-Fi off | The demo video and demo day |
| **B. Phone as a screen, camera and mic** | Phone and laptop on a local Wi-Fi with **no internet**. The phone opens the app in its browser | Showing real photos and voice from a phone. Still 100% offline |
| C. Android APK | A separate native app with the models on the phone | Not built. See the end of this document |

Option A meets the hackathon rule ("the core AI feature must run with the internet switched off"). Option B also meets it, because the phone talks only to the laptop over local Wi-Fi.

## Before going offline (once, with internet)

```bash
cd web
npm install
npm run build
npm run start              # http://localhost:3000
```

Sign in, open **Readiness** (click "AI ready" or "Set up AI" at the top right) and choose **Prepare offline**. This downloads the six model files once (about 3 GB) and indexes the procedures. When every row says **Ready**, nothing else ever needs the network.

## Option A: laptop only

1. Do the "before going offline" step.
2. Turn Wi-Fi off (and unplug Ethernet). Under WSL, turning Windows Wi-Fi off also cuts WSL off.
3. Keep using `http://localhost:3000`: ask, voice, photos, counts and dispatch checks all still work.
4. For the video: show the Wi-Fi icon off, then go through the demo script.

**Automatic proof:** `npm run offline:check` starts the app inside a Linux network namespace that has no network interface except loopback (no Wi-Fi, no DNS, no internet). It confirms the internet is unreachable, then runs every backend and AI check against the app. If anything tried to reach the network, it would fail.

## Option B: phone over local Wi-Fi, still offline

The phone becomes a camera, microphone and touchscreen. The AI still runs on the laptop.

**1. Make a local network with no internet.** The easiest way is the phone's own hotspot with **mobile data turned off**:
- Phone: turn mobile data **off**, then turn the hotspot **on**.
- Laptop: join the phone's hotspot. There is no internet on this network, only the phone and the laptop.

(A travel router with no internet cable works too.)

**2. Serve the app over HTTPS.** Browsers only allow the microphone and live camera on `https://` pages (or `localhost`):

```bash
npm run start      # terminal 1: the app
npm run phone      # terminal 2: prints https://<laptop-ip>:3443
```

`npm run phone` makes a self-signed certificate on the laptop (no internet needed) and forwards to the app.

**3. WSL only: let the phone reach WSL.** WSL2 sits behind Windows, so do one of these on Windows:
- *Mirrored networking (simplest).* Put this in `C:\Users\<you>\.wslconfig`, then run `wsl --shutdown` and reopen WSL:
  ```ini
  [wsl2]
  networkingMode=mirrored
  ```
- *Or a port forward.* In an Administrator PowerShell (replace `<wsl-ip>` with the output of `hostname -I` in WSL):
  ```powershell
  netsh interface portproxy add v4tov4 listenport=3443 listenaddress=0.0.0.0 connectport=3443 connectaddress=<wsl-ip>
  New-NetFirewallRule -DisplayName "Warehouse Copilot" -Direction Inbound -LocalPort 3443 -Protocol TCP -Action Allow
  ```
  Then use the **Windows** IP address (from `ipconfig`) on the phone.

**4. On the phone** open `https://<laptop-ip>:3443`. Accept the certificate warning once ("Advanced", then "Proceed"). Sign in. You can now:
- photograph a delivery note or a shelf with the phone camera (Receive delivery, Count a shelf),
- use **Hands-free** with the phone microphone,
- add the page to the home screen so it opens like an app.

Photos are shrunk on the phone before they are sent (1280 px for documents, 512 px for counting), so this works well over hotspot Wi-Fi.

## What needs a network, and when

| Needs network | When |
|---|---|
| `npm install` | Once, when setting up |
| Prepare offline (model download, about 3 GB) | Once, before going offline |
| Nothing else | Every feature runs with the network off: asking, procedures, voice, document reading, counting, dispatch, handover, sign-in, all data |

The app makes no external requests at runtime: no CDN fonts (Poppins is bundled), no analytics, no remote images. Next.js telemetry is disabled. The browser tests check this on every screen.

## Option C: why there is no APK (yet)

An APK would mean running the models **on the phone itself**. QVAC supports this (Expo on Android 12+, arm64, physical device only, not emulators), but it would be a different app:

- the whole UI would be rewritten in React Native (this app is Next.js),
- the database, auth and services would move onto the phone,
- the phone would need about 3 GB free for models and enough memory to run them.

That is a sensible next step for a warehouse with no laptop at the dock, but it is not needed for the hackathon. The judging asks for a working demo "on your device" with the internet off, and the laptop with option A or B meets that.
