# AppDash

A portal for managing your live Play Store apps: register device tokens, send and schedule push notifications through Firebase Cloud Messaging, and let Claude write the notification copy for you.

```
appdash/
├── backend/    Express 5 + MongoDB API (FCM sending, scheduling, AI generation)
└── frontend/   React 19 + Vite + Tailwind dashboard
```

## Features

- **Apps** – one record per Play Store app with its own SDK key and Firebase credentials.
- **Devices** – your mobile app registers FCM tokens (with user id, platform, tags) through a public SDK endpoint; stale tokens are pruned automatically after sends.
- **Notifications** – compose, target (everyone / platform / tags / user ids / raw tokens), preview on a phone mock-up, send now, schedule, send a test, duplicate, and review delivery stats.
- **AI composer** – describe what you want to announce; Claude returns several variants with rationale and a send-time suggestion. Refine the current draft with one-click instructions ("make it shorter", "add urgency", "translate to Hindi").
- **Overview** – per-app delivery timeline, platform split, top tags and recent campaigns.

## Prerequisites

- Node.js 20+
- MongoDB running locally (or a connection string)
- A Firebase project for each app (service-account JSON)
- An Anthropic API key for the AI composer (optional; everything else works without it)

## Backend

```bash
cd backend
cp .env.example .env      # then fill in the values below
npm install
npm run dev               # nodemon, http://localhost:4000
```

`.env`

| Variable | Purpose |
|---|---|
| `PORT` | API port (default 4000) |
| `CLIENT_ORIGIN` | Allowed CORS origin(s), comma separated |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret for dashboard login tokens |
| `ENCRYPTION_KEY` | 64-char hex key; Firebase private keys are stored AES-256-GCM encrypted with it. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ANTHROPIC_API_KEY` | Enables the AI composer |
| `AI_MODEL` | Claude model id (default `claude-opus-5-5`) |

### API summary

All dashboard routes need `Authorization: Bearer <jwt>`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/register` · `/login` · GET `/me` | Dashboard accounts |
| GET/POST | `/api/apps` | List / create apps |
| GET/PATCH/DELETE | `/api/apps/:appId` | Manage one app |
| GET | `/api/apps/:appId/overview` | Stats for the overview page |
| PUT/DELETE | `/api/apps/:appId/fcm` | Upload / remove Firebase service account (verified with Google before saving) |
| POST | `/api/apps/:appId/sdk-key/rotate` | Rotate the mobile SDK key |
| GET/POST/DELETE | `/api/apps/:appId/devices[/:deviceId]` | Browse, add (manual), remove devices |
| GET/POST | `/api/apps/:appId/notifications` | List / create (`mode`: `draft`, `send`, `schedule`) |
| GET/PATCH/DELETE | `/api/apps/:appId/notifications/:id` | Read / edit / delete |
| POST | `.../:id/send` · `/cancel` · `/duplicate` | Actions |
| POST | `/api/apps/:appId/notifications/estimate` | Reach for a target |
| POST | `/api/apps/:appId/notifications/test` | Send to specific tokens without a record |
| POST | `/api/apps/:appId/ai/generate` | Claude generates variants |
| POST | `/api/apps/:appId/ai/refine` | Claude rewrites the current draft |

Mobile SDK routes use the header `x-api-key: <app sdkApiKey>` instead of a JWT:

| Method | Path | Body |
|---|---|---|
| POST | `/api/sdk/devices/register` | `{ token, platform, deviceId, externalUserId, appVersion, osVersion, model, locale, timezone, tags[] }` |
| POST | `/api/sdk/devices/unregister` | `{ token }` |
| POST | `/api/sdk/devices/tags` | `{ token, add[], remove[] }` |

The Settings page of each app shows a ready-to-paste Kotlin snippet for the register call.

### How sending works

1. The target is resolved to active device tokens.
2. Tokens are sent in batches of 500 with `sendEachForMulticast`.
3. Tokens FCM reports as unregistered or invalid are marked inactive.
4. The notification record stores targeted / delivered / failed counts and any FCM error codes.

Scheduled notifications are picked up by an in-process scheduler every 30 seconds. It claims each due record atomically, so running more than one API instance is safe.

### AI generation

`services/ai.js` calls the Anthropic SDK with structured outputs (Zod schema), so the dashboard always receives well-formed variants. Server-side refusal fallbacks are enabled (`fallbacks: "default"`), and a refusal is surfaced to the user as a readable error rather than a crash. The app's description, brand voice, audience and tone (editable under Settings → AI composer defaults) are included in every prompt.

## Frontend

```bash
cd frontend
cp .env.example .env      # VITE_API_URL=http://localhost:4000/api
npm install
npm run dev               # http://localhost:5173
```

`npm run build` produces a static bundle in `frontend/dist` that can be served by any static host; point `VITE_API_URL` at the deployed API.

## Connecting a real app

1. Create the app in the dashboard (name + Play Store package name).
2. Settings → Firebase: upload the service-account JSON from *Firebase console → Project settings → Service accounts → Generate new private key*.
3. Settings → Mobile SDK integration: copy the SDK key and add the register call to your app (snippet provided).
4. Launch the app on a device; it appears under Devices.
5. Compose a notification, send a test to that device's token, then send to everyone.
