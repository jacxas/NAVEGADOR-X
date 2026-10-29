# Auditoría Bloque F — dashboard, traducción y portapapeles

Fecha: 2026-10-29 · Base: `v0.3.5-alpha` (`4d356ab`) · Rama: `arena/b4cbaaa2-navegador-x`

Las tres quejas del usuario, tal cual, y qué se ha hecho con cada una.

---

## 1. «El dashboard no debería ser igual que el navegador: varias funciones no hacen nada y algunas ni hacen falta»

### Lo que había

El dashboard era una rejilla con cuatro paneles:

| Panel | Qué era en realidad |
| --- | --- |
| Banner de versión | Real (versión inyectada desde `package.json`), pero con dos insignias inventadas: `Runtime OS v1.0 Sincronizado` y `Anti-Fingerprint` como si estuviera activo. |
| `QuickStats` | Real: memoria y CPU del proceso, o del montón JS en la web. |
| `AIActivityFeed` | Real: actividad del kernel. |
| `ConnectionStatus` | Honesto, pero **duplicaba** la pestaña VPN X. |
| `ThreatProtection` | Honesto, pero **duplicaba** el panel Privacy Shield. |

Y dos focos de datos falsos más, en el panel Privacy Shield:

- un contador de «Bloqueos Totales» sembrado en **1.652** y guardado en `localStorage`;
- un «Registro en Tiempo Real» de rastreadores que se generaba con `Math.random()` cada 2,5 s
  (`doubleclick.net`, `hotscript`…), con la etiqueta *Bloqueado* y la insignia
  `100% On-Device Protection`.

### Lo que hay ahora

- **`src/components/QuickActions.tsx`** (nuevo): seis accesos que llevan a algún sitio
  (Navegar, Favoritos, Descargas, IA X, Runtime, Bloqueador) y un bloque «Estado real» con
  edición, versión, motor de navegación, estado de la IA (consultando
  `bridge.ai.hasKey()` o `/api/v1/ai/status`) y persistencia de sesión. Cuando algo no
  aplica se marca en ámbar con su explicación; no se disfraza de verde.
- El dashboard ya **no repite** `ConnectionStatus` ni `ThreatProtection`:
  - `ConnectionStatus` pasa a la pestaña **VPN X**, que es donde el usuario busca su red.
  - `ThreatProtection` pasa al panel **Privacy Shield**, en modo compacto
    (`<ThreatProtection compact />`), sustituyendo al registro inventado.
- Se quitaron del banner la insignia `Runtime OS v1.0 Sincronizado` (no significa nada) y
  `Anti-Fingerprint` (el módulo no altera huellas); en su lugar se muestra el número real de
  módulos y tareas del kernel y `CSP + permisos`.
- El contador de bloqueos de Privacy Shield lee ahora `desktopBridge().blocker.status()`
  (cifra real del bloqueador nativo, refrescada cada 5 s). En la edición web muestra `—` y
  `no disponible en web`, porque el bloqueo ocurre en Electron.
- El pie `100% On-Device Protection` dice lo que toca: `Bloqueador nativo activo` o
  `Solo interfaz en la edición web`.

### Comprobación

`src/__tests__/App.smoke.test.tsx` añade una prueba que monta la aplicación en el dashboard y
comprueba que existe el bloque «Empezar» **y que no** existen los encabezados
`Conexión de red` ni `Protecciones activas` en esa pestaña.

---

## 2. «El traductor abre un recuadro aparte; debe traducir en la propia página»

### Diagnóstico

- La edición web **no puede** traducir en su sitio: el contenido viaja en un `<iframe>` de otro
  origen (`X-Frame-Options`, CSP) y la política de origen del navegador impide leer o escribir su
  DOM. No es un fallo del programa, es una barrera del navegador.
- La Edición de Escritorio **sí puede**: el contenido vive en un `<webview>` propio y
  `executeJavaScript` permite leer los nodos de texto y reescribirlos.

### Implementación

- **`src/lib/pageTranslation.ts`** (nuevo):
  - `buildCollectScript()`: recorre el DOM visible con `TreeWalker`, descarta `SCRIPT`, `STYLE`,
    `CODE`…, marca cada nodo con `data-navx-t` y devuelve `{ id, text }` (máximo 120 nodos).
  - `buildApplyScript()`: escribe la traducción **solo en el nodo de texto**, guarda el original
    en `data-navx-orig` y respeta los elementos hijos (enlaces, imágenes).
  - `buildRestoreScript()`: devuelve la página a su idioma original y limpia las marcas.
  - `translatePageInPlace()`: traduce por trozos de 25 nodos, aplica trozo a trozo (el usuario ve
    avance) y lleva contadores honestos: `translated`, `total`, `failed`.
- **`BrowserViewport`**: nuevos comandos `translate-page` y `restore-page`, y eventos
  `translation.started|progress|done|failed|restored`.
- **`App`**: en escritorio, «Traducir» ya **no abre nada**: lanza la traducción en la página. El
  botón muestra `12/40` mientras avanza y aparece `Original` para deshacer en un clic.
  En la web, el panel pasa a ser **lateral derecho** (antes era un modal centrado que tapaba la
  página), sin fondo oscurecido y sin `aria-modal`.

### Lo que no se puede y ahora se dice

Al probar sin clave de IA, la traducción respondía con texto de relleno de un supuesto
«motor local»: `server.ts` devolvía una traducción inventada sobre túneles cuánticos y nodos VPN
en Suiza, y el cliente la pintaba en el panel como si fuese la página del usuario. Corregido:

- `POST /api/v1/ai/translate` sin clave → **503** con `success:false`, `offline:true` y un mensaje
  que explica qué configurar. Verificado en vivo:

  ```
  HTTP 503
  {"success":false,"offline":true,"provider":"Motor local (sin clave)", ... ,
   "error":"La traducción necesita un modelo de IA. Configura GEMINI_API_KEY …"}
  ```
- `translatePageInPlace` lanza `TranslationError('sin-clave')` cuando el motor responde en modo
  offline: escribir esa simulación encima de la página sería peor que no traducir.
- La interfaz muestra una franja en ámbar con el motivo exacto y un botón **Ajustes de IA**.

---

## 3. «No se puede copiar ni pegar texto»

### Por qué fallaba

`navigator.clipboard.writeText()` devuelve una promesa que se **rechaza** cuando la página no es un
contexto seguro, el iframe no tiene `allow="clipboard-write"` o el usuario no ha dado permiso.
Nadie recogía ese rechazo: el botón mostraba «Copiado» y en el portapapeles no había nada, o
simplemente no pasaba nada. Había tres usos así (`TranslationModal`, `OwnershipPanel`,
`XRayDOMInspector`).

### Arreglo

- **`src/lib/clipboard.ts`** (nuevo): `copyText()` intenta la API moderna, luego
  `execCommand('copy')` con un `textarea` fuera de pantalla y, si tampoco, devuelve
  `{ ok:false, error }` con la instrucción `Ctrl+C`. `readClipboardText()` hace lo mismo para leer.
- Los tres componentes usan `copyText` y muestran el error cuando no se puede.
- **Barra de direcciones**: botones `Copiar la dirección` y `Pegar desde el portapapeles`, con
  aviso en la propia barra si el navegador bloquea el acceso.
- **Selección de texto**: `PrivacyShield`, `XRayDOMInspector`, `TabResourceMonitor` y la barra de
  pestañas llevaban `select-none` sobre paneles con datos (no se podía copiar un hash, una URL o
  una métrica). Se ha quitado de esos paneles y se ha añadido en `index.css` la regla explícita
  `user-select: text` para párrafos, celdas, listas, encabezados, `pre`/`code` y `textarea`. La
  barra de título nativa sigue sin selección, porque se arrastra con el ratón.

### Bug encontrado de paso

`TranslationModal` declaraba `useState` **después** de `if (!isOpen) return null`, es decir, un hook
condicional: al abrir y cerrar el panel React podía lanzar
*«Rendered fewer hooks than expected»*. Movido arriba.

---

## Pruebas

```
npm run verify  →  tsc --noEmit sin errores
                   8 archivos, 77 pruebas, 0 fallos
vite build      →  ✓ built in 9.84s
```

Nuevas: `src/lib/__tests__/clipboard.test.ts` (6) y
`src/lib/__tests__/pageTranslation.test.ts` (18), más dos casos en `App.smoke.test.tsx`.

Cubren, entre otras cosas: que un `writeText` rechazado caiga al plan B; que sin ningún camino se
devuelva un error explicable; que la respuesta del modelo se lea con o sin bloque de código y que
una cantidad distinta de cadenas **no** se escriba; que con el motor local no se toque la página.

## Pendiente y límites

- La traducción en su sitio **no se ha podido probar de punta a punta** en este entorno: hace falta
  el `<webview>` de Electron en Windows y una clave de IA. Lo que está probado es la lógica
  (recogida, troceado, interpretación, aplicación) y que sin clave no se escribe nada falso.
- `gh release download` sigue sin funcionar desde este entorno (`EOF` contra
  `release-assets.githubusercontent.com`).
- La edición web continúa sin poder incrustar Google, YouTube o bancos: es una restricción del
  navegador, no del código.
