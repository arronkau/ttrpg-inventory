# ttrpg-inventory

A shared, real-time inventory manager for tabletop RPG parties. Track characters, storage, containers, items, and coins across the whole party — everyone sees updates immediately.

Built with React + Vite + Tailwind, with Firebase (Firestore + anonymous auth) for sync.

## Features

- **Per-party shared inventory** — every party has a unique URL; share it with the table
- **Characters, storage, and containers** — characters carry containers; storage entries track party inventory that is not being carried
- **Coins, treasure, counted items, and equipment suggestions** — platinum / gold / silver / copper, named treasure, count controls for items named like `Torch (3)`, and autocomplete for standard adventuring gear
- **Item-based encumbrance** — speed is calculated from equipped slots, packed slots, and each character’s STR modifier
- **Audit log** — see edits, deletes, and cross-character moves; coin edits include the amount changed
- **Backup and restore** — export or import the full party and audit log as JSON from Settings
- **Drag-and-drop item movement** — reorder items within a container, move them between containers, characters, and storage
- **Bulk transfer** — move all items from one container to another in one click
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
├── characters/{characterId}                          -- one doc per character or storage entry
│   ├── characters: name, order, strengthModifier
│   ├── storage: name, order, isStorage, storageLimit
│   └── containers: [{ id, name, weight, maxCapacity, items: [...] }]
└── metadata/party-data/entries/{entryId}             -- one doc per audit log entry
    └── action, description, timestamp                -- ISO string, queried desc
```

A "party" is just a UUID in the URL (`/abcd-1234-...`). New visitors are redirected to either their last visited party (from `localStorage`) or a freshly generated UUID. Share a party URL to share its inventory.

### Storage

Use **Add New Storage** for party inventory that is not being carried by a character, such as `The Bank` or `The Hole next to the Oak Tree`. Storage entries appear after characters and use an amber outline. A storage entry has a name and an optional slot limit; `0` means infinite. If a slot limit is set, the storage header shows the current slots against that limit, such as `2/10 slots`. Storage entries support adding items, JSON import, drag-and-drop, item details transfer, and transfer-all.

### Item movement

Use the grab handle on the left side of an item to drag it into a new order, into another container, or onto a character's or storage entry's container. Drop an item on a container title to put it at the top of that container, including when the container is collapsed. Dropping coins into a container that already has coins merges them. The audit log records item moves only when the item changes owner, not when it moves between containers on the same character or storage entry.

### Counted items

Any normal item whose name ends in a plain number in parentheses, such as `Torch (3)` or `Iron Spike (12)`, gets small `−` and `+` controls in the item row. These controls only change the number in the item's name; the slot value stays whatever the item is set to use.

### Backup and restore

Open Settings to export a JSON backup containing the party settings, all characters, storage entries, containers, items, and the audit log. Importing a backup JSON file replaces the current party data with the contents of that file.

### Item-based encumbrance

This fork uses Gavin Norman’s item-based encumbrance approach. Each character has four built-in equipped containers: `Left Hand`, `Right Hand`, `Armor`, and `Other Equipped`. Those containers appear under the `Equipped` heading and count toward equipped slots. `Left Hand`, `Right Hand`, and `Armor` can each hold only one item, though that item may be worth multiple slots; those single-item equipped containers are filled by dragging items into them. User-created containers appear under the `Stowed` heading; their contents plus any non-zero container slots count toward packed slots. The `Equipped` and `Stowed` headings each show their own max speed and current slot total; the character header shows the slower speed only. Overloaded characters get a red outline, and an overloaded section shows `Overloaded` in red. Each character stores a `strengthModifier` directly, and that modifier is applied to the packed-slot movement bands. The numeric item field is still named `weight` for backwards compatibility, but it represents item slots by default.

## Bulk import format

The `{ }` button next to "Add Item" accepts a JSON array — one object per item to add to that container. Three item types are supported.

**Normal items**

```json
{ "name": "Longsword", "weight": 1, "description": "A fine steel blade" }
```

| Field | Required | Default |
|---|---|---|
| `name` | ✓ | — |
| `weight` | | `0` (slots) |
| `description` | | `""` |
| `isUnidentified` | | `false` |
| `secretName` | when unidentified | `""` |
| `secretDescription` | when unidentified | `""` |

**Coins** (`itemType: "coins"`)

```json
{ "itemType": "coins", "coins": { "gold": 50, "silver": 20 } }
```

`coins` takes any of `platinum`, `gold`, `silver`, `copper` (at least one must be > 0). Slots are computed (up to 100 coins = 1 slot, rounded up). Importing coins into a container that already has a coins item merges them.

**Treasure** (`itemType: "treasure"`)

```json
{ "itemType": "treasure", "name": "Ruby", "goldValue": 100, "quantity": 2, "weightPerItem": 0 }
```

| Field | Required | Default |
|---|---|---|
| `name` | ✓ | — |
| `goldValue` | | `0` |
| `quantity` | | `1` |
| `weightPerItem` | | `0` |
| `description` | | `""` |

Total slots is `weightPerItem × quantity`. Treasure can be liquidated into coins from the item details modal.

You can paste a single object instead of an array if you're only adding one item.

## Development

```sh
npm run dev      # start dev server
npm run build    # production build to dist/
npm run preview  # preview production build
```

## License

MIT
