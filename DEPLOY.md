# Deployment auf Cloudflare Pages

Die App ist eine statische Vite-Seite. Cloudflare Pages baut sie aus dem GitHub-Repository
`onurkoc/ground-curve-JS`.

## 1. Pages-Projekt anlegen

Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → Repository `onurkoc/ground-curve-JS`.

| Einstellung | Wert |
|---|---|
| Framework preset | None (oder Vite) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | (leer, Repository-Wurzel) |
| Build system version | v3 (Node.js 22 als Standard) |
| Umgebungsvariable (optional) | `NODE_VERSION = 22` |

`public/_headers` und das Favicon werden von Vite unverändert nach `dist/` kopiert.

## 2. Branch control (nur Vorschau aus `web`)

`main` enthält bis zum Merge noch die Electron-Version und darf nicht gebaut werden.

**Settings → Builds → Branch control**

- Production branch: `main`
- **Enable automatic production branch deployments: aus** (bis `web` nach `main` gemergt ist)
- Preview branch: **Custom branches**
  - Include: `web`
  - Exclude: (leer)

Vorschau-URL des Branches: `https://web.<projekt>.pages.dev`

Nach dem Merge von `web` nach `main`: automatische Production-Deployments wieder einschalten.

## 3. Eigene Domain

**Custom domains → Set up a custom domain** → Hostname unter der Zone `onurkoc.net` eintragen
(im Folgenden `<HOST>`, z. B. `groundcurve.onurkoc.net`). Pages legt den CNAME auf `<projekt>.pages.dev` an.

### Cache Rule der Zone `onurkoc.net`

Pages setzt eigene Cache-Header (`public/_headers`):

| Pfad | Cache-Control |
|---|---|
| `/`, `/index.html` | `no-cache` |
| `/assets/*` | `public, max-age=31536000, immutable` |

Bestehende Cache Rules der Zone (z. B. „Cache Everything" / „Eligible for cache" mit Edge-TTL-Override)
gelten auch für den Pages-Hostnamen und können nach einem Deploy veraltetes `index.html` ausliefern.
Darum für den Hostnamen eine eigene Regel **vor** den übrigen Regeln ergänzen:

**Caching → Cache Rules → Create rule**

- Name: `groundcurve – Pages-Header respektieren`
- When incoming requests match: `Hostname equals <HOST>`
- Then: **Bypass cache**
  (Pages liefert die Dateien ohnehin aus dem eigenen, pro Deploy invalidierten Cache.)

Alternativ, falls `/assets/*` zusätzlich am Edge gecacht werden soll: zweite Regel
`Hostname equals <HOST> and URI Path starts with /assets/` → Eligible for cache, Edge TTL „Use cache-control header if present".
Bei veralteten Inhalten: **Caching → Configuration → Purge Everything**.

## 4. Prüfung nach Domain-Einrichtung

```bash
HOST=<HOST>

# HTML: 200, Cache-Control: no-cache
curl -sI "https://$HOST/" | grep -iE "^HTTP|cache-control|cf-cache-status"
curl -sI "https://$HOST/index.html" | grep -iE "^HTTP|cache-control"

# Asset-Namen aus dem HTML holen, dann: public, max-age=31536000, immutable
ASSET=$(curl -s "https://$HOST/" | grep -oE 'assets/index-[^"]+\.js' | head -1)
curl -sI "https://$HOST/$ASSET" | grep -iE "^HTTP|cache-control|content-type"

# Favicon: 200 (kein 404)
curl -sI "https://$HOST/favicon.ico" | grep -iE "^HTTP|content-type"
```

Erwartung: `cache-control: no-cache` für HTML, `public, max-age=31536000, immutable` für das JS-Asset,
`cf-cache-status` beim HTML nicht `HIT` mit altem Stand.

## 5. Lokal prüfen

```bash
npm ci
npm run test
npm run build
npm run preview    # http://localhost:4173
```
