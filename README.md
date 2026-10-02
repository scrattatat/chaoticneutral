# D&D character sheet + session notes

Uses the D&D 2024 rules (5.5e).

A static web app (no bundler, no backend) backed by Firebase: phone-number
sign-in (Firebase Auth) and per-user storage (Firestore). Anyone can sign in
and gets their own private character list.

## Local development

```sh
npm install -g firebase-tools
firebase emulators:start     # then open http://127.0.0.1:5000
```

The emulator suite serves Hosting + Firestore + Auth together. The Auth
emulator accepts any phone number with the fixed code `123456`, so you can
exercise the full sign-in flow without sending real SMS.

## Where things are saved

| What | Location |
|---|---|
| Character sheets | `users/{uid}/characters/{id}` (Firestore) |
| Session notes | `users/{uid}/characters/{id}/notes/{filename}` (Firestore) |
| Deleted characters | `users/{uid}/trash/{id}` (sheet and notes are moved here, not erased) |

The `{id}` comes from the character's name when you create them (e.g. `fynne`).
Session notes are plain Markdown with YAML frontmatter (`session`, `date`, `title`, `tags`),
stored as-is in each note's `content` field.

Access is scoped per signed-in user by `firestore.rules` — nobody can read or write
another user's `users/{uid}/...` data.

## Deploying

```sh
firebase deploy
```

Pushing to `main` also deploys automatically via
`.github/workflows/firebase-hosting-merge.yml` (GitHub Actions).

Before first deploy, in the Firebase console for this project:
- Authentication → Sign-in method → enable **Phone**.
- Firestore Database → create a database (Native mode).
- Project settings → General → Your apps → copy the web app config into
  `static/firebase-init.js` (replacing the `REPLACE_ME` placeholders).

If you have existing data from the old local-file version, run
`scripts/migrate-to-firestore.mjs` once to import it (see that file's header
comment).

## Characters and settings

- Click the character's name (top left) to switch characters, create a new one or delete the current one.
  The open character is in the URL (`?c=fynne`), so different tabs can show different characters.
- The ⚙ button opens per-character settings. You can turn off XP and item-weight tracking for campaigns
  that don't use them. This only hides them, so nothing is lost.

## Features

- **Sheet**: abilities, saves and skills (click the dot to cycle none → proficient → expertise),
  with modifiers, proficiency bonus, initiative and passive Perception worked out for you.
  HP has damage/heal buttons (damage uses up temp HP first; Enter = damage, Shift+Enter = heal),
  "Spend hit die" (rolls die + CON and heals you), and death saves. A long rest restores HP, spell slots
  and all hit dice, and removes one level of exhaustion. The exhaustion tracker (levels 1–6) shows the
  d20 and speed penalties. Attacks have a Weapon Mastery column.
- **Spells**: spell save DC and attack bonus, spell slot pips (filled = available), spell list.
- **Gear**: coins and inventory, with total weight.
- **Sessions**: Markdown editor with a live preview that handles Obsidian syntax
  (`[[wikilinks]]`, `#tags`, `==highlights==`, callouts, task lists, tables).
  "New session" starts a numbered, dated note from a template.
  Link to a note with `#notes/<filename>`.

Everything autosaves. **Ctrl+Z** undoes the last change to the character sheet, and **Ctrl+Shift+Z** or **Ctrl+Y** redoes it.
Inside a text box, Ctrl+Z is the browser's normal text undo. Undo history resets when you reload the page.

## Themes

The default theme is **Tidepool**, a cozy pixel-art merfolk look:
- Pixel fonts, bundled in `static/fonts/` so the app works offline.
- Notched pixel frames, square pips and a segmented HP bar.
- An underwater scene: bubbles, swaying seaweed, a clownfish and a crab.
- Little effects: music notes when you use Bardic Inspiration, hearts when you heal, a shake when you take damage.

The scene and effects turn off if your system is set to reduce motion.

How it's built:
- `static/themes.css` holds every theme's colors and fonts, one `[data-theme="…"]` block per theme.
- `static/pixel.css` reshapes the components for Tidepool. Everything in it is scoped to `[data-theme="tidepool"]`.
- `static/sprites.js` draws the pixel art from ASCII grids. Edit a grid, or add one plus a palette color, to change a sprite.

To add a theme, add a block to `themes.css` and add it to `THEMES` in `static/app.js`.
It then appears in the theme picker (top right), which remembers your choice in this browser.
