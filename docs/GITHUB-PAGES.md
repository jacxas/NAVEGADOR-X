# Edición web en GitHub Pages

Estado a 2026-10-29: **sitio publicado y verificado** en
https://jacxas.github.io/NAVEGADOR-X/ —con una salvedad importante en el origen de
Pages, ver «Origen mal configurado» más abajo.

## Por qué los 4 despliegues anteriores fallaron

Los cuatro `github-pages` que aparecen como *Failed to deploy* (#1 a #4, de los commits
`70f6e3e`, `2551ced`, `1b14193` y `6a1ded7`) son de antes de retirar el `deploy.yml`
antiguo. Todos fallaron por lo mismo: **Pages nunca se habilitó en el repositorio**, así
que `actions/deploy-pages` no tenía dónde publicar. No era un fallo del código ni del
build.

- `GET /repos/jacxas/NAVEGADOR-X/pages` → **404** (el sitio no existe).
- `POST /repos/jacxas/NAVEGADOR-X/pages` (habilitarlo por API) → **403
  `Resource not accessible by integration`**: el token de Actions no tiene permiso de
  administración del repositorio. **Yo no puedo habilitarlo.**

Esos cuatro registros son historial de despliegues: se pueden desactivar desde la API,
pero no borrar, y no afectan a nada una vez que el nuevo workflow funcione.

## Lo que sí está hecho

`.github/workflows/deploy.yml` (nuevo, en `main` tras el merge):

1. **Compila y prueba** en cada push a `main` (`npm run lint`, `npm test`).
2. **Comprueba si Pages está habilitado** (`GET /pages`):
   - `404` → no despliega, deja un aviso y un resumen en el job. **El CI queda en verde**,
     no rojo como antes.
   - Cualquier otro código → despliega (para no saltarse un despliegue real por un fallo
     transitorio de la API).
3. **Verifica el build bajo subpath** con `npm run check:pages`: sirve `dist/` en
   `/NAVEGADOR-X/` y pide cada script, hoja de estilos y fuente. Si Vite volviera a un
   `base` absoluto, esto falla antes de publicar.
4. Sube el artefacto y despliega con `actions/deploy-pages@v4`.

## Estado real (comprobado el 2026-10-29 06:05 UTC)

Pages quedó **habilitado**, y el workflow desplegó: la página responde y sirve la
aplicación (se comprobó leyendo el HTML publicado, no solo el log).

```
GET /repos/jacxas/NAVEGADOR-X/pages
→ status "built", build_type "legacy", source { branch: "main", path: "/" }
```

### Origen mal configurado (queda un clic)

El origen es **«Deploy from a branch: main / (root)»** (`build_type: legacy`), no
«GitHub Actions». Consecuencias:

- Cada push a `main` dispara **dos** publicaciones: `pages-build-deployment` (que publica
  el **código fuente del repositorio**, incluido `index.html` apuntando a `/src/main.tsx`,
  que no es JS compilado) y mi workflow (que publica `dist/`).
- La última en terminar es la que se ve. En el push del 06:05 ganó la del workflow, pero
  es una carrera: en otro push puede quedar publicado el árbol de fuentes y la web se
  rompe.
- La API no me deja cambiarlo: `PUT /pages` con `build_type=workflow` devuelve **403
  `Resource not accessible by integration`**.

**Cambio necesario (Settings → Pages → Build and deployment → Source: GitHub Actions).**
Al hacerlo desaparece `pages-build-deployment` y solo publica el workflow, con el build
verificado.

## Verificación hecha

1. `GET /pages` → sitio creado, `html_url: https://jacxas.github.io/NAVEGADOR-X/`.
2. Run **Deploy web edition (GitHub Pages)** `40827117730`: `build` y `deploy` en verde,
   incluido el paso `Verify the build works under a subpath`.
3. **HTML publicado leído**: sirve la aplicación real (cabecera «Saltar al contenido»,
   pestañas, dashboard), no el `index.html` de desarrollo.
4. Ahí se detectó un fallo de contenido: la interfaz anunciaba **v0.3.0-alpha** yendo por
   la 0.3.4. Corregido: la versión se inyecta desde `package.json` (`src/lib/version.ts`)
   y una prueba comprueba que no vuelva a escribirse a mano.

## Qué funcionará y qué no en esa URL

| Función | En Pages |
|---|---|
| Interfaz completa, pestañas, inspector, ajustes | Sí |
| Persistencia local (IndexedDB, localStorage) | Sí, por navegador |
| Fuentes y estilos | Sí, servidas desde el propio sitio (sin peticiones a Google) |
| Navegación externa | Limitada por CSP: las webs se abren en iframe si el sitio lo permite |
| Inicio de sesión con Google | **Probablemente no** hasta añadir `jacxas.github.io` en Firebase → Authentication → Authorized domains. El error se muestra en pantalla y la app sigue usable sin cuenta |
| IA de Gemini | Solo si sirves `/api/v1/ai/*`; en Pages es estático y responde el motor local |

## Comprobaciones hechas en local

```
npm run build                       → dist/ con rutas relativas (./assets/…)
npm run check:pages                 → 8/8 referencias y fuentes en 200
                                      sin @import externo, sin /assets/ absolutos
build con --base=/ (caso malo)      → check:pages sale 1 y explica el fallo
```

El caso negativo se probó a propósito: un build con `base` absoluto hace que
`check:pages` falle con «index.html usa rutas absolutas /assets/». Es decir, la
comprobación no es decorativa.

## Fuentes: se sirven desde el propio sitio

La hoja de estilos importaba `fonts.googleapis.com`, y la CSP de la aplicación
(`style-src 'self'`, `font-src 'self'`) lo bloqueaba: la interfaz llevaba tiempo
mostrándose con las fuentes del sistema sin avisar. Ahora `@fontsource-variable/inter` y
`@fontsource-variable/jetbrains-mono` se empaqueta con el build (12 `.woff2`,
`unicode-range` por subconjunto) y **no se hace ninguna petición a Google**, que además
encaja mejor con la promesa de privacidad del producto.
