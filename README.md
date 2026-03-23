# Ashura Server

The backend that powers the Ashura desk companion. It acts as a bridge between the ESP32 firmware and anything else on your network — a WebSocket hub the device stays connected to, plus a small REST API for controlling WLED lights.

---

## What it does

**WebSocket hub** — The ESP32 connects here on boot and stays connected. The server handles device registration, heartbeats, and can push commands (like `display_message`) down to the device in real time.

**WLED control** — A thin HTTP client that talks to WLED devices on your local network. You can register WLED devices and then control them (power, brightness, color, effects) via the REST API.

**Device registry** — Keeps track of what's currently connected — both ESP32 clients over WebSocket and WLED devices registered manually.

---

## Stack

- **Next.js** (App Router) for the API routes
- **ws** for the WebSocket server, attached to the same HTTP server
- **TypeScript** throughout

---

## Running locally

```bash
npm install
npm run dev
```

The dev script runs a custom `server.ts` (not `next dev`) so the WebSocket server and Next.js share one HTTP port — defaults to `3000`.

---

## API

| Method | Path | What it does |
|--------|------|-------------|
| `GET` | `/api/devices` | List connected ESP32 devices and registered WLED devices |
| `POST` | `/api/devices` | Register a WLED device |
| `GET` | `/api/wled/[deviceId]` | Get current state of a WLED device |
| `POST` | `/api/wled/[deviceId]` | Control a WLED device (see actions below) |

**WLED actions** (sent as `{ "action": "...", ...params }` in the POST body):
`turnOn`, `turnOff`, `setBrightness`, `setColor`, `setEffect`, `setPreset`, `setState`

---

## WebSocket

Devices connect at `ws://localhost:3000/ws`. The server expects a `register` message on connect, then periodic `heartbeat` messages. Devices that miss heartbeats are automatically removed. You can push `command` or `notification` messages to any registered device by its ID.
