# chord-viewer

A simple web tool, that let's me create, view and play songs with chords and text.

## Setup

```sh
pnpm install
cp config.example.json config.json   # then set your password
pnpm dev
```

`config.json`: `password` is the login password, and `title` is the browser tab title (default "Chord Viewer"). `statuses` lists the song statuses you can pick (default: Idea, In progress, Practicing, Done). `dataDir` is where the SQLite DB and audio files go (default `./data`).
Set `CHORD_VIEWER_CONFIG=/path/to/config.json` to use a config file somewhere else.

## Production

```sh
pnpm build
pnpm start   # node build, with a 500 MB upload limit (BODY_SIZE_LIMIT); PORT/HOST as usual
```

To deploy behind Apache as a reverse proxy, see [docs/deploy-apache.md](docs/deploy-apache.md).

Login uses challenge-response, so the password is never sent. The browser sends `HMAC-SHA256(SHA-256(password), nonce)` and gets back an HttpOnly session cookie that lasts 30 days.
Use HTTPS if it's reachable from the internet, because the session cookie is still sent with every request.

## Usage

- **Edit**: click a chord or lyric row to type. The chord row types in overwrite mode, so chords keep their columns.
  `Enter` splits a line, `Backspace` at the start of a line joins it with the previous one, and `↑`/`↓` move between rows.
  A line that gets too long wraps into a new line pair on its own. Changes auto-save. Undo with `Ctrl+Z`, redo with `Ctrl+Shift+Z` or `Ctrl+Y`.
- **Sync** (in edit mode): playback starts from 0. Press `Space` at each chord change, `Backspace` to undo the last tap, and `Esc` to stop.
- **Play**: highlights the current chord and its lyric segment, and scrolls along if "Follow" is on. `Space` toggles play/pause, and the progress bar seeks.
- **Status**: each song has a status dropdown (overview, setlist builder and edit mode). The options come from `statuses` in `config.json`. Changing a status does not move the song in the "last edited" order.
- **Setlists**: "☰ Setlists" on the overview. Build named setlists by adding songs from the library (+ or drag and drop), reorder them by dragging or with ↑/↓, and filter the library by name or status. "▶ Play setlist" opens the first song with previous/next navigation. "↓ Download all" makes the whole setlist available offline.
- **Offline**: on the song overview, ↓ downloads a song (text, chords, timestamps and audio) for offline use. ✓ means it is available offline (click to remove), ↻ means the offline copy is outdated. Offline storage needs HTTPS or localhost.
