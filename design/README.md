# Design prototype

A clickable, non-functional design preview of the Brownstones Coffee team app —
used to validate direction before wiring up the backend.

- **`Brownstones-App-Preview.html`** — the standalone, self-contained preview.
  Open it in any browser (phone or desktop). Fonts and branding are inlined, so
  it works offline and can be emailed/messaged to anyone with no account needed.
- **`prototype.src.html`** — editable source. Uses `@@FONT400@@` / `@@FONT700@@`
  placeholders for the Playfair Display woff2 files (from
  `@fontsource/playfair-display`), which are base64-inlined at build time.

## Rebuild the standalone file after editing the source

```bash
cd node_modules/@fontsource/playfair-display/files
base64 -w0 playfair-display-latin-400-normal.woff2 > /tmp/pf400.b64
base64 -w0 playfair-display-latin-700-normal.woff2 > /tmp/pf700.b64
# then substitute the two @@FONT...@@ placeholders in prototype.src.html and
# wrap in a <!doctype html> document -> Brownstones-App-Preview.html
```

This is a design reference only. The real UI lives in `src/app/` and is wired to
Supabase; screens here map to those routes.
