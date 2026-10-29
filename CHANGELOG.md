# Changelog — X Browser & X Runtime OS

All notable changes to this project are documented in this file.

## [v0.3.5-alpha] - 2026-10-29

### Added
- `deploy.yml` para publicar la edición web en GitHub Pages. Si Pages no está habilitado,
  el workflow compila, avisa y **no falla**; cuando se habilite, publica solo.
- `npm run check:pages`: sirve `dist/` bajo `/NAVEGADOR-X/` y comprueba que cada script,
  hoja de estilos y fuente responde 200. Se ejecuta en el propio workflow antes de
  desplegar.
- `docs/GITHUB-PAGES.md` con el estado, el paso que falta y qué funciona en esa URL.

### Fixed
- Las tipografías no se cargaban: la hoja de estilos importaba Google Fonts y la CSP
  (`style-src 'self'`) lo bloqueaba, así que la interfaz usaba las fuentes del sistema.
  Ahora Inter y JetBrains Mono se empaquetan con el build (`@fontsource-variable`): sin
  peticiones a terceros y respetando la CSP.

## [v0.3.4-alpha] - 2026-10-29

### Fixed
- Barra duplicada en la Edición de Escritorio: los tres puntos decorativos de estilo macOS
  ya no aparecen cuando la ventana tiene su propia barra de título con los controles reales.
- La barra de direcciones tenía un prefijo fijo `navigatorx://` que se sumaba al valor y
  duplicaba el esquema. Ahora muestra un icono del esquema real (interna, HTTPS o HTTP) con
  su descripción para lectores de pantalla.
- Panel de administración cortado: usaba `calc(100vh - 64px)` y no descontaba la barra de
  pestañas ni la de direcciones. Ahora ocupa la altura disponible (`h-full min-h-0`).
- `localhost:3000` se interpretaba como un esquema propio y no se abría nunca; se resuelve
  como dirección, igual que `127.0.0.1:3000`.

### Added
- Pruebas unitarias con Vitest y Testing Library (21 pruebas) y paso nuevo en CI.
- Foco visible en toda la interfaz, con color propio en el tema Light Aura.
- Pestañas accesibles: `tablist`/`tab`, flechas e Inicio/Fin para moverse, Delete para
  cerrar y etiquetas para lectores de pantalla.
- Los diálogos (aviso de minería y traducción) atrapan el foco, se cierran con Escape y
  devuelven el foco al elemento que los abrió.
- Enlace «Saltar al contenido», `lang="es"` en el documento y respeto a
  `prefers-reduced-motion`.

### Changed
- «Historial» y «Ajustes» de la barra lateral se muestran como no disponibles: antes eran
  botones que no hacían nada al pulsarlos.

### Added (release)
- `release.yml` ahora verifica antes de compilar (typecheck + pruebas) y comprueba que la
  etiqueta coincida con `package.json`; si no, falla en vez de publicar un binario con la
  versión equivocada.
- Compilación en ruta corta (`C:\nx`): NSIS generaba includes de más de 260 caracteres y
  el empaquetado fallaba en carpetas profundas.
- `SHA256SUMS.txt` adjunto a cada release, y las versiones con sufijo (`-alpha`, `-beta`,
  `-rc.1`) se marcan como pre-release de forma automática.
- Firma de código preparada: con los secretos `CSC_LINK`/`CSC_KEY_PASSWORD` el workflow
  firma y **falla si la firma no es válida**; sin ellos publica sin firmar y lo advierte.
- `docs/RELEASE.md` (procedimiento y verificación) y `docs/FIRMA-DE-CODIGO.md` (opciones,
  costes y activación).

### Security (servidor web)
- El servidor escucha por defecto en **127.0.0.1**, no en `0.0.0.0`. Exponerlo a la red
  local pasa a ser una decisión explícita (`NAVEGADOR_HOST=0.0.0.0`).
- Límite de peticiones por origen: 30/min en IA y 60/min en escrituras; responde 429 con
  `Retry-After`.
- Validación de entrada: `prompt` ≤ 8 000 caracteres, `pageContent` ≤ 20 000, `url` ≤ 2 048,
  idioma de destino de una lista cerrada, cuerpo JSON ≤ 256 kB.
- Las sesiones y preferencias que se guardan en disco se copian con un saneador que
  descarta `__proto__`/`constructor`/`prototype`, funciones, fechas y profundidad excesiva.
- Los identificadores de ruta se validan (`^[A-Za-z0-9_-]{1,64}$`).
- Los errores del proveedor de IA ya no devuelven el mensaje interno al cliente (queda en
  el registro del servidor); un JSON malformado responde 400 y una ruta de API inexistente
  responde 404 JSON, no el `index.html`.
- Un puerto ocupado ya no deja un proceso vivo sin servir nada: informa y sale con error.
- La credencial de Gemini vive en `server/gemini.ts` y solo se lee de `GEMINI_API_KEY`;
  hay un endpoint `/api/v1/ai/status` que dice si está configurada sin revelarla.

## [v0.3.3-alpha] - 2026-10-28

### Security
- Firestore rules no longer allow a user to change their own `earnings`; only an admin can.
- `logs` writes are validated: known fields, message ≤ 500 characters, type whitelist.

### Changed
- The mining panel keeps its X-COIN counter in memory; it no longer writes a balance to Firestore.
- Removed the GitHub Pages workflow: Pages was never enabled, so it failed on every push. The web
  edition runs locally with `npm run dev`.

### Added
- Release workflow: pushing a `v*` tag builds the Windows installers from that commit and publishes them.

## [v0.3.2-alpha] - 2026-10-28

### Fixed
- Typecheck is green again: the IndexedDB promise in `AIChat` is typed as `Promise<void>`
  (it was the single TS2794 error behind a red `npm run lint`).

### Security
- The model credential is stored with Electron `safeStorage` (DPAPI on Windows,
  Keychain on macOS, libsecret on Linux) and migrated from the old plaintext
  `settings.json` on first launch. If the platform offers no keystore, nothing is written.
- `will-attach-webview` now **blocks** any source outside `http(s)`, `app://`,
  `navegador://` and `runtime://`; previously it only logged a warning.
- PWA shortcuts quote the URL and reject whitespace and quotes, closing an argument
  injection path into the Chromium command line.

### Added
- CI workflow: `tsc --noEmit`, renderer build and Electron shell build on every push and PR.

## [v0.3.0-alpha] - 2026-10-10

### Added
- **Native ad and tracker blocker**: network-level filtering in the main process
  (`webRequest.onBeforeRequest`) with real counters, top-blocked-domain breakdown, a pause
  switch, and **user-importable filter lists** (`hosts` format or EasyList domain rules).
  The bundled list is small, hand-written and conservative; no third-party list is shipped.
- **Ownership tab** in the owner panel: author, licence, version, runtime, install paths and
  the licence terms, all read from the running program rather than typed by hand, plus a
  one-click “copy ownership notice”.
- **Real network proxy** applied to the browser session: SOCKS5, SOCKS4, HTTP and HTTPS.
  Input is validated (scheme whitelist, host syntax, port range) and no PAC scripts or
  built-in server lists are accepted — the user chooses the server.
- **Proxy authentication** through Electron's `login` event. Credentials live in the main
  process memory only and are never written to disk.
- **Real connectivity test** that travels through the configured route (`ses.fetch`) and
  reports the HTTP status and latency.
- **Verifiable state**: the panel displays the value Electron itself resolves
  (`resolveProxy`), so it can never claim a route it does not have.
- **`NetworkPanel`** component wired into the VPN view, replacing guesswork with a
  functional configuration form.
- **Per-tab routing**: a tab can be given its own session partition (`persist:navegadorx-tab-…`)
  with its own cookie jar and proxy route, isolated from the shared session. Partition names
  are validated in the main process against a strict pattern.
- **Tor shortcuts** in the panel that point the proxy at a local instance (9050/9150).
  No Tor daemon is bundled: the browser connects to what the user already runs.
- **Auth error messages**: Firebase failures (notably `auth/unauthorized-domain` on the
  `app://` origin) now surface as readable, actionable notices instead of console noise.
- **Bundle splitting**: vendor chunks for React, Firebase, charts, motion and icons, plus
  on-demand loading of the AI and X-Ray panels. The entry chunk drops from 1.6 MB to 268 kB
  (68 kB gzipped) and the size warning disappears.
- **Smaller installer**: only the `es` and `en-US` Electron locales are packaged.
- **OAuth child window**: sign-in flows from Firebase/Google now open in their own child
  window instead of being dismissed to the system browser, so the credential can return
  to the application.
- **QA capture mode** (`NAVEGADORX_SCREENSHOT`, `NAVEGADORX_OPEN_URL`) for automated
  screenshots of the running application.

### Changed
- The VPN view now leads with the real proxy configuration, followed by the node list
  clearly labelled as decorative.
- Gemini requests authenticate through the documented query parameter, keeping every
  credential out of the source tree.
- Internal identifier for stored secrets renamed to `credencial` / `proxyCredentials`
  for consistency across the shell and the renderer.

### Fixed
- The webview API is no longer called before `dom-ready`; combined with the new
  `ErrorBoundary`, a failing panel can no longer blank the whole window.
- Firebase popups no longer escape silently to the system browser.
- **Internal URL schemes did nothing**: the Spanish scheme names (`navegador://mineria`,
  `://mercado`, `://ia`, `://favoritos`) did not match the English tab ids, so typing them in
  the address bar had no effect. An alias map now resolves them, and the tab label comes from
  the sidebar instead of the raw identifier.

### Verified
- With a non-existent proxy the request fails with `ERR_PROXY_CONNECTION_FAILED`; after
  returning to direct mode the same request answers HTTP 200 in ~270 ms.
- `resolveProxy` reports `DIRECT` or `SOCKS5 host:port` exactly as configured.
- With a proxy applied to a dedicated tab, that tab fails while the shared session keeps
  answering HTTP 200 — the two routes are genuinely isolated.
- A partition outside the allowed pattern is rejected with "Partición no válida".
- The blocker was observed cancelling real requests on a real site
  (`tpc.googlesyndication.com`, `static.doubleclick.net`) and on a scripted probe.

---

## [v0.2.0-alpha] - 2026-10-10

### Added
- **Desktop Edition (Electron)** with a real browsing engine: `<webview>` in an isolated
  process, a persistent session partition, and per-tab navigation history.
- **Real downloads to disk** intercepted in the main process (`will-download`) with
  progress, speed, pause, resume, cancel, open file and reveal in folder.
- **Secure `app://bundle` protocol** so the interface runs on a standard, secure origin
  (localStorage, IndexedDB and Firebase behave exactly as on the web).
- **Native window experience**: custom title bar with min/max/close, application menu,
  keyboard shortcuts, single-instance lock and external links routed to the system browser.
- **Unified AI client** (`src/lib/aiClient.ts`): Gemini through the main process on desktop,
  through the Express proxy on web, and a local offline engine when no key exists.
- **AI engine settings panel** to store a Gemini key in the user data directory.
- **`ErrorBoundary`** so a failing panel can no longer blank the whole window.
- **`SimulationNotice`** component, applied to every interface-only module.
- **Content Security Policy** for the interface (no `unsafe-eval`).
- **Real runtime activity feed**: the dashboard now streams actual `EventBus` events.
- **Real process metrics**: `QuickStats` reports measured memory, CPU and process count
  (desktop) or `performance.memory` (web) instead of invented hashrate/VPN figures.
- **Desktop protections panel** listing only protections that are actually enforced, plus
  an explicit list of what the app does *not* do.
- Tooling: `scripts/build-electron.mjs`, `scripts/generate-icon.py`,
  `scripts/qa-screenshot.mjs`, `scripts/qa-console.mjs`.

### Changed
- Vite `base` is now relative (`./`), so a single build serves GitHub Pages, the Express
  server and the desktop shell.
- Session persistence, page-load telemetry and the address bar are driven by real viewport
  events (`viewport.state`, `viewport.loading`, `viewport.loadend`) on the kernel EventBus.
- `DownloadManager` uses native downloads on desktop and clearly-labelled demo rows on web.
- Version bumped to `0.2.0-alpha` across `package.json`, UI and documentation.
- `npm start` now runs the TypeScript server through `tsx`; `npm run clean` is cross-platform.

### Fixed
- Navigating to a real site could crash the whole interface: the webview API was being
  called before the element emitted `dom-ready`. All webview calls are now guarded.
- Broken favicon/stat feeds in the dashboard no longer throw when no server is present.

### Security
- `contextIsolation` and `sandbox` enabled; `nodeIntegration` disabled.
- Every `<webview>` is hardened in `will-attach-webview` (preload stripped, sandbox forced).
- Camera, microphone, geolocation, notifications and other permissions are denied by default.
- The Gemini credential never reaches the renderer.

### Honesty
- The mining, VPN/Tor and Privacy Shield panels are now explicitly labelled as interface
  demonstrations, and the project states it will not implement real mining.

---

## [v0.1.0-alpha] - 2026-07-31

### Added
- Implemented **X Runtime OS** microkernel architecture with `BrowserKernel`, `CapabilityContract`, `ProviderContract`, `RuntimeScheduler`, and `EventBus`.
- Added **Runtime Inspector** for live diagnostic inspection of processes, memory, and kernel event logs.
- Added **Status & Roadmap Timeline Matrix** modal with transparent release progress tracking.
- Added comprehensive system documentation (`STATUS.md`, `ARCHITECTURE.md`, `ROADMAP.md`).
- Added robust error handling listeners (`network.online`, `network.offline`, `runtime.error`) to `BrowserKernel`.

### Changed
- Replaced mock setup downloader with transparent **Desktop Edition — Coming Soon (v0.1.0-alpha)** roadmap interface.
- Standardized terminology across the application (`X Runtime OS`, `Browser Kernel`, `Capability System`, `Provider System`).
- Updated Firestore security rules (`firestore.rules`) to enforce role-based access for `users`, `vpn_nodes`, and `logs`.

### Fixed
- Handled Firestore read permissions for authenticated users on `vpn_nodes`.
- Fixed error handlers for snapshot subscriptions in `AdminPanel`, `MinerDashboard`, and `AIChat`.
