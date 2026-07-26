# PDF Leader

A side project built on free time — a desktop PDF editor and automation tool.

> Create an issue if you find a bug.

---

## Known Bug
After uploading a PDF the main screen may briefly say "error uploading file", but the file is loaded correctly. Rotate the page to any angle and revert it back to restore the view.

---

## Features

### PDF Editor
- Upload and view PDF files
- Annotate with text, shapes (rectangles, ellipses), freehand drawing, arrows, and lines
- Highlight content and add signatures
- Undo/redo annotation history
- Export PDF with annotations embedded

### PDF Tools
- **Merge** — combine multiple PDFs into one
- **Split** — extract individual pages or page ranges
- **Crop** — crop page dimensions
- **Compress** — reduce file size using object streams
- **Rotate** — rotate individual or all pages
- **Delete pages** — remove specific pages
- **Add page numbers** — insert page numbers at configurable positions
- **Edit text** — modify existing text in PDFs (supports Unicode / ₹ rupee symbol)

### Automator
Batch-process a folder of PDFs automatically. Detects and replaces fields such as:
- Names
- Dates
- Prices / monetary values

Configure your own rules depending on the PDF structure and what you want to change.

---

## macOS Desktop App (DMG)

PDFLeader ships as a standalone one-click macOS desktop app — no terminal, no Node.js install required.

### Download / Build

```bash
# 1. Install all dependencies (only needed once, or after pulling changes)
npm run install:all

# 2. Build the DMG
npm run dist
# → dist/PDFLeader-1.0.0-arm64.dmg
```

### Install
1. Open `dist/PDFLeader-1.0.0-arm64.dmg`
2. Drag **PDFLeader** into your **Applications** folder
3. First launch: right-click → **Open** to bypass the Gatekeeper warning (app is not code-signed)

### How it works
The `.app` bundle starts a local Express server on port 3001 inside a `utilityProcess`, then opens a native window pointing to `http://localhost:3001`. Uploaded PDFs are stored in `~/Library/Application Support/PDFLeader/uploads/` (not inside the read-only app bundle).

---

## Development

### Prerequisites
- Node.js 18+
- npm

### Setup

```bash
npm run install:all   # installs root + server + client dependencies
npm start             # starts Express (port 3001) and Vite dev server (port 5173)
```

The Vite dev server proxies all `/api` requests to the Express backend, so you can work on the React frontend with hot reload.

---

## Debugging the Desktop App

If the app opens blank, the server failed to start. A log file is written every time the app runs:

```
~/Library/Logs/PDFLeader/debug.log
Debugging the app

Every time the app runs it now writes a full log to:
~/Library/Logs/PDFLeader/debug.log

If it's still blank, run this in Terminal right after opening the app:
cat ~/Library/Logs/PDFLeader/debug.log

Or watch it live:
tail -f ~/Library/Logs/PDFLeader/debug.log

The log will tell you exactly which check failed — whether the script path is wrong, node_modules is missing, the server crashed with an error, or port 3001 is already in use by something else.
```

Check it with:

```bash
cat ~/Library/Logs/PDFLeader/debug.log
```

Or watch it live while the app is open:

```bash
tail -f ~/Library/Logs/PDFLeader/debug.log
```

You can also run the app directly from Terminal to see output inline:

```bash
/Applications/PDFLeader.app/Contents/MacOS/PDFLeader
```

Common causes of a blank window:
| Symptom in log | Fix |
|---|---|
| `script exists: false` | Re-run `npm run dist` — `extraResources` copy failed |
| `node_modules present: false` | Run `npm run install:all` then `npm run dist` |
| `server exited — code=1` | Check `[server-err]` lines for the actual Node.js error |
| `server not ready after 10 s` | Another process is already using port 3001 |

---

## Project Structure

```
PDFLeader/
├── client/          # React + Vite frontend
│   └── src/
│       └── components/
├── server/          # Express backend + PDF processing
│   ├── index.js
│   └── uploads/     # runtime upload directory (dev only)
├── automator/       # standalone batch-processing service
├── main.js          # Electron entry point
└── package.json
```
