# D&D character sheet + session notes

Uses the D&D 2024 rules (5.5e).

A local web app with no dependencies (Python 3.10+ standard library only).

```sh
python3 server.py            # then open http://127.0.0.1:8765
python3 server.py --port 9000
```

## Where things are saved

| What | Default location | Override |
|---|---|---|
| Character sheets | `data/characters/<id>.json`, one per character | `DND_DATA_DIR` |
| Session notes | `data/notes/<id>/*.md`, one folder per character | `DND_NOTES_DIR` |
| Deleted characters | `data/trash/` (sheet and notes are moved here, not erased) | |

The `<id>` comes from the character's name when you create them (e.g. `fynne`).
If you're upgrading from the single-character version, `data/character.json` and any loose notes
are moved into this layout the first time the server starts.

Session notes are plain Markdown with YAML frontmatter (`session`, `date`, `title`, `tags`).
To write them straight into your Obsidian vault, point `DND_NOTES_DIR` at a vault folder.
Each character gets a subfolder:

```sh
DND_NOTES_DIR=~/Obsidian/Vault/DnD python3 server.py   # -> ~/Obsidian/Vault/DnD/fynne/*.md
```

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
