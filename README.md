# IPN Catalyst Spin Wheel

A static, Netlify-ready spin wheel for summit winner selection.

## Run locally

Run `npm run dev`, then open `http://127.0.0.1:3000/`.

You can also open `index.html` directly, or serve the folder with any static server.

## Deploy

Deploy the repository as a static site. Netlify can use the included `netlify.toml`; no build command is required and the publish directory is the repository root.

## Files

- `index.html` - page structure and inline SVG icon sprite
- `styles.css` - presentation and responsive layout
- `app.js` - wheel rendering, spin logic, local storage, sound, fullscreen, history, import/export
- `assets/` - local visual assets
