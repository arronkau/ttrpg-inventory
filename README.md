# ttrpg-inventory

A shared, real-time inventory manager for tabletop RPG parties. Track characters, containers, items, and coins across the whole party — everyone sees updates immediately.

Built with React + Vite + Tailwind, with Firebase (Firestore + anonymous auth) for sync.

## Features

- **Per-party shared inventory** — every party has a unique URL; share it with the table
- **Characters and containers** — each character holds containers (backpack, mule, chest, etc.); containers hold items
- **Coins and treasure** — platinum / gold / silver / copper, with automatic weight calculation; named treasure items track gold value
- **Weights and encumbrance** — formatted weight totals per container, character, and party
- **Audit log** — see who changed what, when
- **Bulk transfer** — move all of one character's items to another in one click
- **Import items** — paste a list of items to add at once
- **Real-time sync** — Firestore `onSnapshot` keeps every connected client in lockstep
- **Anonymous auth** — no signup, just open the link

## Self-hosting

This repo is meant to be deployed to your own Firebase project. Hosting it costs nothing for small parties on Firebase's free tier.

### 1. Create a Firebase project

Go to [Firebase Console](https://console.firebase.google.com), create a new project, then:

- **Authentication** — enable the *Anonymous* sign-in provider
- **Firestore Database** — create a database in production mode
- **Project Settings → Your apps** — register a new Web app and copy the config values

### 2. Configure Firestore security rules

Paste these rules into Firestore Rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /artifacts/{appId}/public/data/dnd_inventory/{partyId}/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

These restrict reads and writes to authenticated users (anonymous auth counts) and scope all data under `artifacts/{appId}/public/data/dnd_inventory/`. Anyone with a party URL who is signed in (i.e. has loaded the page) can read and write that party's data, which matches the "share the URL with your table" model.

### 3. Configure the app

```sh
git clone <your-fork-url>
cd ttrpg-inventory
cp .env.example .env.local
# Edit .env.local and fill in your Firebase config values
npm install
npm run dev
```

The values from `.env.example` are pulled from Firebase Console → Project Settings → Your apps → SDK setup and configuration. They're embedded in the client bundle at build time, so they aren't truly secret — your data is protected by the Firestore rules above, not by hiding the API key.

### 4. Deploy

Any static host works (Firebase Hosting, Vercel, Netlify, GitHub Pages, Cloudflare Pages). For Firebase Hosting:

```sh
npm install -g firebase-tools
firebase login
firebase init hosting   # point public dir to "dist", configure as SPA
npm run build
firebase deploy
```

Make sure to set the Vite env vars in your hosting provider's environment so the production build picks them up.

## Data model

The Firestore layout looks like:

```
artifacts/{appId}/public/data/dnd_inventory/{partyId}/
├── characters/{characterId}                          -- one doc per character
│   ├── name, order
│   └── containers: [{ id, name, weight, items: [...] }]
└── metadata/party-data/entries/{entryId}             -- one doc per audit log entry
    └── action, description, timestamp                -- ISO string, queried desc
```

A "party" is just a UUID in the URL (`/abcd-1234-...`). New visitors are redirected to either their last visited party (from `localStorage`) or a freshly generated UUID. Share a party URL to share its inventory.

## Bulk import format

The `{ }` button next to "Add Item" accepts a JSON array — one object per item to add to that container. Three item types are supported.

**Normal items**

```json
{ "name": "Longsword", "weight": 4, "description": "A fine steel blade" }
```

| Field | Required | Default |
|---|---|---|
| `name` | ✓ | — |
| `weight` | | `0` (lbs) |
| `description` | | `""` |
| `isUnidentified` | | `false` |
| `secretName` | when unidentified | `""` |
| `secretDescription` | when unidentified | `""` |

**Coins** (`itemType: "coins"`)

```json
{ "itemType": "coins", "coins": { "gold": 50, "silver": 20 } }
```

`coins` takes any of `platinum`, `gold`, `silver`, `copper` (at least one must be > 0). Weight is computed (50 coins = 1 lb, floored). Importing coins into a container that already has a coins item merges them.

**Treasure** (`itemType: "treasure"`)

```json
{ "itemType": "treasure", "name": "Ruby", "goldValue": 100, "quantity": 2, "weightPerItem": 0.1 }
```

| Field | Required | Default |
|---|---|---|
| `name` | ✓ | — |
| `goldValue` | | `0` |
| `quantity` | | `1` |
| `weightPerItem` | | `0` |
| `description` | | `""` |

Total weight is `weightPerItem × quantity`. Treasure can be liquidated into coins from the item details modal.

You can paste a single object instead of an array if you're only adding one item.

## Development

```sh
npm run dev      # start dev server
npm run build    # production build to dist/
npm run preview  # preview production build
```

## License

MIT
