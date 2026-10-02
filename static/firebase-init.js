// Firebase compat SDK setup: Google sign-in + Firestore CRUD helpers.
// Classic script (not a module), loaded before app.js. Exposes window.Auth
// and window.DB; app.js owns all DOM/UI logic and only calls into these.
// Everything else here is wrapped in an IIFE so these internal helper names
// (saveNote, saveCharacter, etc.) don't leak as globals and collide with
// app.js's own top-level names of the same kind.
(function () {

// Your web app's Firebase configuration

const firebaseConfig = {

  apiKey: "AIzaSyDR3eEAPdwayrmAsD6-wReCECZ6vmZj3mE",
  authDomain: "snackweek-13e97.firebaseapp.com",
  databaseURL: "https://snackweek-13e97.firebaseio.com",
  projectId: "snackweek-13e97",
  storageBucket: "snackweek-13e97.firebasestorage.app",
  messagingSenderId: "275232921517",
  appId: "1:275232921517:web:c009a6a86f924a8196b324"

};


firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Local dev: talk to the emulator suite instead of the real project.
if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
  auth.useEmulator("http://localhost:9099", { disableWarnings: true });
  db.useEmulator("localhost", 8080);
}

// ---------------------------------------------------------------- auth
const googleProvider = new firebase.auth.GoogleAuthProvider();

const Auth = {
  onReady(cb) {
    auth.onAuthStateChanged(cb);
  },
  get uid() {
    return auth.currentUser?.uid ?? null;
  },
  signIn() {
    return auth.signInWithPopup(googleProvider);
  },
  signOut() {
    return auth.signOut();
  },
};
window.Auth = Auth;

// ---------------------------------------------------------------- helpers
function slugify(name) {
  const slug = String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
  return slug || "character";
}

function charactersRef(uid) {
  return db.collection("users").doc(uid).collection("characters");
}
function notesRef(uid, cid) {
  return charactersRef(uid).doc(cid).collection("notes");
}
function trashRef(uid) {
  return db.collection("users").doc(uid).collection("trash");
}

async function uniqueId(uid, name) {
  const base = slugify(name);
  let cid = base, n = 2;
  while ((await charactersRef(uid).doc(cid).get()).exists) {
    cid = `${base}-${n}`;
    n++;
  }
  return cid;
}

// Minimal YAML frontmatter reader: flat `key: value` pairs only. Mirrors
// server.py's parse_frontmatter.
function parseFrontmatter(text) {
  if (!text.startsWith("---")) return {};
  const end = text.indexOf("\n---", 3);
  if (end === -1) return {};
  const meta = {};
  for (const line of text.slice(3, end).split("\n")) {
    if (line.includes(":") && !/^[ \t-]/.test(line)) {
      const i = line.indexOf(":");
      const key = line.slice(0, i).trim();
      const value = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, "");
      meta[key] = value;
    }
  }
  return meta;
}

// ---------------------------------------------------------------- characters
async function listCharacters(uid) {
  const snap = await charactersRef(uid).get();
  return snap.docs.map((d) => {
    const v = d.data();
    return {
      id: d.id, name: v.name || "", class: v.class || "", level: v.level || "", race: v.race || "",
      mtime: v.updatedAt?.toMillis?.() ?? 0,
    };
  });
}

async function getCharacter(uid, cid) {
  const doc = await charactersRef(uid).doc(cid).get();
  if (!doc.exists) throw new Error("character not found");
  return doc.data();
}

async function createCharacter(uid, data) {
  const cid = await uniqueId(uid, data.name || "character");
  await charactersRef(uid).doc(cid).set({ ...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
  return { id: cid };
}

async function saveCharacter(uid, cid, data) {
  await charactersRef(uid).doc(cid).set({ ...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
}

// Deleting a character moves its sheet and notes into a trash collection
// rather than erasing them, mirroring the old data/trash/ behaviour.
async function deleteCharacter(uid, cid) {
  const ref = charactersRef(uid).doc(cid);
  const doc = await ref.get();
  if (!doc.exists) throw new Error("character not found");
  const notesSnap = await notesRef(uid, cid).get();
  const notes = notesSnap.docs.map((d) => ({ filename: d.id, content: d.data().content }));
  const batch = db.batch();
  batch.set(trashRef(uid).doc(cid), {
    character: doc.data(), notes, deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  batch.delete(ref);
  for (const d of notesSnap.docs) batch.delete(d.ref);
  await batch.commit();
}

// ---------------------------------------------------------------- notes
async function listNotes(uid, cid) {
  const snap = await notesRef(uid, cid).get();
  return snap.docs.map((d) => {
    const v = d.data();
    const meta = parseFrontmatter(v.content || "");
    return {
      file: d.id, title: meta.title || d.id.replace(/\.md$/, ""), date: meta.date || "",
      session: meta.session || "", mtime: v.updatedAt?.toMillis?.() ?? 0,
    };
  });
}

async function getNote(uid, cid, file) {
  const doc = await notesRef(uid, cid).doc(file).get();
  if (!doc.exists) throw new Error("note not found");
  return { file, content: doc.data().content };
}

async function saveNote(uid, cid, file, content) {
  await notesRef(uid, cid).doc(file).set({ content, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
}

// Refuses to overwrite an existing note.
async function createNote(uid, cid, file, content) {
  const ref = notesRef(uid, cid).doc(file);
  if ((await ref.get()).exists) throw new Error("a note with that name already exists");
  await ref.set({ content, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
  return { file };
}

async function deleteNote(uid, cid, file) {
  const ref = notesRef(uid, cid).doc(file);
  if (!(await ref.get()).exists) throw new Error("note not found");
  await ref.delete();
}

window.DB = {
  listCharacters, getCharacter, createCharacter, saveCharacter, deleteCharacter,
  listNotes, getNote, saveNote, createNote, deleteNote,
};

})();
