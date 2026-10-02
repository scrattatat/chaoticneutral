#!/usr/bin/env node
// One-time import of the old local data/ layout into Firestore, under a
// single uid. Not run in CI; run manually once per person migrating data.
//
//   npm install firebase-admin   # or: npx --package firebase-admin node ...
//   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
//     node scripts/migrate-to-firestore.mjs <uid> [data-dir]
//
// <uid> is the Firebase Auth uid of the account to own this data (Firebase
// console -> Authentication, after signing in once with that account).

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import admin from "firebase-admin";

const [, , uid, dataDirArg] = process.argv;
if (!uid) {
  console.error("Usage: node scripts/migrate-to-firestore.mjs <uid> [data-dir]");
  process.exit(1);
}
const dataDir = path.resolve(dataDirArg || "data");

admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();

async function migrateCharacters() {
  const charDir = path.join(dataDir, "characters");
  const files = (await readdir(charDir).catch(() => [])).filter((f) => f.endsWith(".json"));
  for (const file of files) {
    const cid = file.slice(0, -".json".length);
    const data = JSON.parse(await readFile(path.join(charDir, file), "utf8"));
    await db.collection("users").doc(uid).collection("characters").doc(cid)
      .set({ ...data, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    console.log(`character: ${cid}`);
    await migrateNotes(cid);
  }
}

async function migrateNotes(cid) {
  const notesDir = path.join(dataDir, "notes", cid);
  const files = (await readdir(notesDir).catch(() => [])).filter((f) => f.endsWith(".md"));
  for (const file of files) {
    const content = await readFile(path.join(notesDir, file), "utf8");
    await db.collection("users").doc(uid).collection("characters").doc(cid).collection("notes").doc(file)
      .set({ content, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    console.log(`  note: ${file}`);
  }
}

await migrateCharacters();
console.log("Done.");
