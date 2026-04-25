# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
npm run dev      # Vite dev server
npm run build    # production build to dist/
npm run preview  # serve the built bundle
npm run lint     # eslint . — note: no eslint config is checked in, so this fails until one is added
```

There is no test runner configured. Local dev requires `.env.local` populated from `.env.example` with Firebase web-app config values (see README for project setup and required Firestore rules).

## Architecture

This is a Firebase-backed, real-time shared inventory tool for TTRPG parties. There is no backend — the React client talks directly to Firestore, and `onSnapshot` listeners push updates to every connected client.

### Data model — important

Firestore layout, scoped per party:

```
artifacts/{appId}/public/data/dnd_inventory/{partyId}/
├── characters/{characterId}                          -- one doc per character
│   └── { name, order, containers: [{ id, name, weight, maxCapacity, items: [...] }] }
└── metadata/party-data/entries/{entryId}             -- one doc per audit log entry
    └── { action, description, timestamp }            -- ISO-string timestamp, queried desc
```

**Only characters are top-level docs.** Containers and items are nested arrays inside the character document. Every mutation that touches `containers[]` follows the same pattern, wrapped in a Firestore transaction so concurrent edits on the same character can't lose updates:

```js
await runTransaction(db, async (txn) => {
  const characterDoc = await txn.get(characterRef);
  if (!characterDoc.exists()) return;
  const characterData = characterDoc.data();
  const updatedContainers = /* immutably map over containers */;
  txn.update(characterRef, { containers: updatedContainers });
});
```

Cross-character operations (`handleTransferAllItems`, `handleTransferItem`) read both character docs inside the transaction and write both — the transaction body must do all reads before any writes.

`addAuditLogEntry` is called *after* the transaction returns. To pass values out (character/container names for the log message), the transaction returns a `result` object and the post-txn code reads from it. We accept that an audit log write could fail without rolling back the mutation; in that case the user's action still went through, just without a log line.

Audit log entries are individual docs in a subcollection — append-only, no read-modify-write race. The reader uses `query(entriesRef, orderBy('timestamp', 'desc'))`.

### Routing and party identity

`App.jsx` mounts a single route `/:partyId`. A party is just an opaque ID (typically a UUID). Unknown routes redirect to either the last-visited party (from `localStorage.lastVisitedParty`) or a freshly generated UUID. Sharing a party means sharing its URL; access control is "anyone authenticated who knows the URL," enforced by the Firestore rules in the README. Auth is anonymous (`signInAnonymously`) and happens on first load.

### Component layout

`InventoryAppContent.jsx` (~2500 lines) is the app. It owns:

- All Firestore subscriptions (`onSnapshot` for characters and audit log).
- All mutation handlers (add/delete/rename/transfer/identify/liquidate/import/etc.).
- All modal-open state — the UI is a stack of modals (`AddItemInputModal`, `ItemDetailsModal`, `ContainerDetailsModal`, `CharacterDetailsModal`, `TransferAllItemsModal`, `ImportItemsModal`, `AuditLogModal`, `DeleteConfirmationModal`, plus the generic `Modal` / `GenericInputModal`).
- The character grid renderer (responsive 1–4 columns based on viewport width).

When adding a new mutation, follow the existing pattern: validate `db && userId && partyId`, fetch the character doc, mutate the `containers` array immutably, `updateDoc`, then `addAuditLogEntry`. For cross-character changes use `writeBatch`.

### Item types

Items in a container's `items` array are heterogeneous. The discriminators are:

- `itemType: 'coins'` — has a `coins: { platinum, gold, silver, copper }` object. Weight is computed (`50 coins = 1 lb`, floored) in `src/utils/coins.js`. When adding/transferring coins into a container, code should merge with any existing coins item — see the merge logic in `handleAddItemSubmit` and `mergeContainerCoins`.
- `itemType: 'treasure'` — has `goldValue`, `quantity`, `weightPerItem`. Can be "liquidated" into a coins item.
- `isUnidentified: true` — has `secretName` and `secretDescription` shown only in details until the item is "identified."
- otherwise: a plain item with `name`, `weight`, `description`.

Weights are stored as pounds (despite the `formatWeightInStones` legacy name in `src/utils/utils.js`, which is now just an alias for `formatWeight`).

### Firebase config

Vite env vars (`VITE_FIREBASE_*`) are inlined into the client bundle at build time — they are not secrets. Data protection comes from the Firestore rules, not from hiding the API key. Don't add server-side env handling; there is no server.
