# Derby Squares — Netlify Functions

A clean 20×20 grid with **selection → hold → pay (demo)** using **Netlify Functions** for storage.

## Deploy (Netlify)
1. New site from Git → this repo
2. **Build settings**
   - Base directory: *(leave blank)*
   - Publish directory: `public`
   - Functions directory: `netlify/functions`
3. (Optional for local dev) Set env var `LOCAL_FALLBACK=1` so storage uses `/tmp` if Blobs isn't available locally.
4. Deploy → open `/api/ping` then `/api/list`.

## Endpoints
- `GET /api/ping` → `{ ok: true }`
- `GET /api/list` → grid state (creates on first call)
- `POST /api/hold` → `{ name, email, squares:[{row,col}] }`
- `POST /api/pay` → `{ name, email }`
- `GET /api/health` → counts for available/held/paid

## Notes
- Storage uses **Netlify Blobs** when available, falling back to ephemeral `/tmp`.
- The frontend always shows a grid; if `/api/list` fails, it renders a local demo with a banner.
