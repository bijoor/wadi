# Hosting the template catalog

The "Choose your home" gallery loads templates from a **catalog source**
(`editor/src/io/templateSource.ts`). By default that's the copy bundled with the
app (`/templates`), so it works offline and on GitHub Pages. To grow the library
**without redeploying the site or the desktop app**, host the catalog somewhere
and point the app at it. The source URL is inspected and dispatched to an adapter,
so more than one kind of host is supported:

| Source | Adapter | Needs |
| --- | --- | --- |
| Cloudflare R2 public bucket | generic | public bucket URL + CORS |
| jsDelivr (a GitHub repo) | generic | a public repo |
| any static HTTPS host | generic | CORS |
| a shared Google Drive **folder** | gdrive | a Google API key (Drive API) |
| bundled with the app | generic | nothing (offline default) |

Templates are pure data (`.wadi` JSON, Zod-validated before load; formulas are a
safe mini-language, no `eval`), so remote download is a data fetch, not code
execution. The app validates every template and falls back to the bundled copies
if the source is unreachable.

## Catalog layout (same for every host)

Source of truth: `editor/public/templates/`.

```
index.json                     # { "templates": [ { id, title, description, meta, file } ] }
blank.json                     # a template config; `file` names are relative to the catalog
single_story_cottage.wadi
family_home.wadi
```

`meta` drives the gallery filters: `{ bedrooms, bathrooms, floors, style, roof,
minWidthFt, minLengthFt, parametric }`. `file` is the config's file **name** (e.g.
`single_story_cottage.wadi`). Preview images live inside each `.wadi` as
`thumbnails: string[]` (captured by the architect editor).

**You don't hand-write `index.json`.** `scripts/gen-catalog-index.mjs` regenerates
it from the `.wadi` files — it derives `bedrooms` / `bathrooms` / `floors` /
`parametric` from each config and preserves the editorial fields
(`title`, `description`, `style`, `roof`, `minWidthFt`, `minLengthFt`). The publish
script runs it automatically. So **adding a template = drop the `.wadi` in
`editor/public/templates/` → publish**; tweak style/roof/description in `index.json`
afterwards only if you want.

## Point the app at a source

- **Per user, no rebuild:** in the app, **New → Change source…** → paste the URL.
  (For a Drive folder, a second field for the API key appears.) Stored locally; the
  gallery reloads. Blank clears it back to the bundled copies. The desktop app
  caches downloaded templates under its app-data dir → offline after first fetch.
- **As the shipped default:** set `REMOTE_TEMPLATES_URL` in
  `editor/src/io/templateSource.ts`, then rebuild. The bundled templates remain the
  offline fallback.

---

## Option A — Cloudflare R2 (recommended)

Zero egress, CDN-backed, upload-to-add.

> ⚠️ **wrangler `login` (OAuth) has no R2 scope**, so the CLI returns
> `code: 10042` even with R2 enabled. Provision via the **dashboard**, or give the
> publish script an **R2 API token** (below).

### Dashboard path (no secrets to handle)
1. R2 → **Create bucket** `wadi-templates`.
2. Bucket → **Settings → Public access → r2.dev** → *Allow* (gives a
   `https://pub-<hash>.r2.dev` URL), or attach a **custom domain**. That URL is your
   catalog source.
3. Bucket → **Settings → CORS policy** → add:
   ```json
   [{ "AllowedOrigins": ["*"], "AllowedMethods": ["GET", "HEAD"], "AllowedHeaders": ["*"], "MaxAgeSeconds": 3600 }]
   ```
4. Upload the files from `editor/public/templates/` (drag-drop in the dashboard, or
   the script below).

### Publish via CLI

One-time: create an **Account API token** with **R2 Storage: Edit**
(dash.cloudflare.com → My Profile → API Tokens), then drop it into a gitignored
`.env.r2` at the repo root:

```bash
cp .env.r2.example .env.r2        # account id + bucket already filled in
# edit .env.r2, paste your token into CLOUDFLARE_API_TOKEN=
```

From then on, publishing is just:

```bash
./scripts/publish-templates.sh
```

It regenerates `index.json` from the `.wadi` files and uploads the whole catalog
to R2. (Env vars still override the file if you'd rather export them.)

Point the app at `https://templates.wadi.house` (or `https://pub-<hash>.r2.dev`).

### Update a template's previews (typical loop)
1. In the app (Nakasha): capture/curate shots (📸 / ✨ / per-view 📸 / 🗂 Shots).
2. **Save** the `.wadi` into `editor/public/templates/<name>.wadi` (Save in place if
   you Loaded it from there; else Save As over it). The `thumbnails` ride along;
   parametric `variables`/`formulas` are preserved.
3. `./scripts/publish-templates.sh`
4. Reopen the gallery (fetch is cache-busted) — new previews appear.

---

## Option B — Google Drive (folder)

Works through the Drive API. More setup than R2 and **experimental** until verified
with a live key.

1. Create a folder in Drive, put `index.json` + the `.wadi` files in it, and share
   the folder **"Anyone with the link → Viewer."**
2. In **Google Cloud Console**: create a project, **enable the Drive API**, create an
   **API key**. Restrict it to the **Drive API** (Tauri can't be origin-locked, so a
   referrer restriction would block the desktop app — leave HTTP-referrer
   unrestricted or accept mild quota exposure).
3. In the app: **New → Change source…** → paste the folder link
   (`https://drive.google.com/drive/folders/<ID>`) and the **API key**.

The adapter lists the folder (`files.list`) to map file names → IDs, then fetches
each with `?alt=media&key=`. If listing a public folder with an API key is refused
on your account, tell me and I'll switch the Drive index to explicit file-IDs.

---

## Keep the bundled fallback fresh

The bundled copies (`editor/public/templates/` → `docs/*/templates/`) are the
offline/first-run set. Keep at least the flagship templates there so a brand-new
install or an offline session still shows homes.
