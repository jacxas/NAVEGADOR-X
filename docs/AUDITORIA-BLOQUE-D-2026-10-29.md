# Bloque D — Servidor web (`server.ts`)

Fecha: 2026-10-29 · Versión en el árbol: `0.3.4-alpha` (sin etiquetar)
Base: `arena/6125c9b5-navegador-x` tras el Bloque C (`c35c4fd`)

Este bloque hace lo que quedaba pendiente del servidor: dejar de escuchar en todas
las interfaces, validar lo que entra y no devolver al cliente lo que no debe.

> **Sobre el guardián de secretos.** En mi entorno de trabajo la escritura de
> `server.ts` **no** fue bloqueada esta vez, así que el archivo está parcheado en la
> rama. No hay ninguna credencial nueva: la clave sigue leyéndose solo de
> `GEMINI_API_KEY` y no se escribe en disco. Si en tu máquina el guardián vuelve a
> rechazar el archivo, el cambio íntegro está en
> `git show <commit>:server.ts` y en `server/gemini.ts` + `server/guardrails.ts`.

---

## 1. Ya no escucha en `0.0.0.0`

```ts
// server.ts
function resolveHost(): string {
  const requested = process.env.NAVEGADOR_HOST?.trim() || "127.0.0.1";
  ...
}
const HOST = resolveHost();
const PORT = Number(process.env.PORT || 3000);
```

| Antes | Ahora |
|---|---|
| `app.listen(3000, "0.0.0.0")` → cualquier equipo de la red podía abrir `http://tu-ip:3000` | `127.0.0.1` por defecto: solo este equipo |
| Puerto fijo 3000 | `PORT` configurable |
| Puerto ocupado → traza sin salida clara | mensaje explícito y `process.exitCode = 1` |

Para exponerlo a propósito: `NAVEGADOR_HOST=0.0.0.0 npm run dev`.

Verificado en la máquina:

```
PORT=3999 npx tsx server.ts   → LISTEN 127.0.0.1:3999
curl http://127.0.0.1:3999/api/v1/ai/status → 200
```

## 2. La credencial, aislada

La lectura de la clave salió de `server.ts` a `server/gemini.ts`:

- Una sola función (`getGeminiClient`) lee `GEMINI_API_KEY` del entorno.
- Sin clave devuelve `null` y el servidor responde con el motor local; la aplicación
  arranca igual.
- Tiempo máximo por llamada al proveedor: 30 s (antes una petición podía quedarse
  colgada y ocupar una conexión para siempre).
- `GET /api/v1/ai/status` → `{ configured: false, model: "local-offline" }`. Dice si
  hay clave, nunca cuál es.

## 3. Validación de entrada

Todo en `server/guardrails.ts`, con pruebas propias.

| Endpoint | Regla |
|---|---|
| `POST /api/v1/ai/query` | `prompt` obligatorio, ≤ 8 000 caracteres; `systemInstruction` ≤ 2 000 |
| `POST /api/v1/ai/translate` | `url` obligatoria ≤ 2 048; `targetLanguage` de la lista cerrada del selector; `pageContent` ≤ 20 000 |
| `POST /api/v1/sessions` | cuerpo objeto, saneado antes de escribir en disco |
| `PUT /api/v1/sessions/:id` | `id` con `^[A-Za-z0-9_-]{1,64}$` + cuerpo saneado |
| `GET/PUT /api/v1/ai/preferences/:userId` | `userId` con el mismo patrón; escritura saneada |
| Cualquier `POST`/`PUT` | cuerpo JSON ≤ 256 kB |

El saneador (`sanitizeRecord`) descarta `__proto__`, `constructor` y `prototype`, se
salta funciones, `NaN`/`Infinity`, fechas y objetos que no sean planos, limita la
profundidad a 4, las claves a 40 y las cadenas a 2 000 caracteres. Sin él, el cuerpo
de la petición se escribía tal cual en `seeds/*.json`.

## 4. Límite de peticiones

`createRateLimiter` — ventana fija en memoria, por dirección de conexión (no se confía
en `X-Forwarded-For`):

- IA: **30 peticiones/minuto**.
- Escrituras: **60 peticiones/minuto**.
- Respuesta al pasarse: `429` con `Retry-After`.

Prueba real contra el servidor: 26 respuestas `200` y a partir de ahí `429`.

## 5. Respuestas que no filtran

- Los errores del proveedor de IA ya no devuelven `details: error.message`; el detalle
  queda en el registro del servidor y el cliente recibe `502` genérico.
- JSON malformado → `400 {error: "JSON malformado."}` (antes, un error sin manejar).
- Cuerpo demasiado grande → `413`.
- Ruta de API inexistente → `404` **JSON**; antes caía en el `index.html` del SPA y el
  cliente fallaba al parsearlo.
- `x-powered-by` desactivado.

## 6. Pruebas

`server/__tests__/guardrails.test.ts` — **19 pruebas**:

- validación de `prompt`, `systemInstruction`, `url`, idioma y `pageContent` (límites
  exactos incluidos);
- identificadores de ruta: acepta `abc123`, rechaza `../etc/passwd`, `a/b`, vacío, 65
  caracteres, números y objetos;
- saneador: descarta funciones, fechas, `Infinity`, claves peligrosas; recorta
  profundidad, claves y cadenas; comprueba que no se contamina `Object.prototype`;
- limitador: máximo por origen, contadores independientes por IP, reinicio de ventana,
  configuración inválida.

Total del proyecto: **40 pruebas** (21 del Bloque C + 19 nuevas).

## 7. Verificación ejecutada

```
npm run lint            → 0 errores
npm test                → 5 archivos, 40 pruebas, 40 correctas
npm run build           → OK
npm run build:electron  → OK
npm run dev (default)   → escucha en 127.0.0.1
curl /api/v1/ai/status              → 200 {"configured":false,"model":"local-offline"}
curl /api/v1/ai/query {}            → 400 «prompt» es obligatorio…
curl /api/v1/ai/query {"prompt":""} → 400
curl /api/v1/ai/query {"prompt":"hola"} → 200 motor local
curl /api/v1/ai/translate idioma inventado → 400
curl /api/v1/no-existe             → 404 JSON
curl JSON malformado               → 400 JSON malformado
curl PUT /api/v1/sessions/..%2Fetc → 400 Identificador no válido
31 peticiones seguidas a /api/v1/ai/query → 200 … 429
```

## 8. Nota sobre la vista previa de este entorno

La vista previa entra desde fuera del contenedor, así que aquí el servidor se arranca
con `NAVEGADOR_HOST=0.0.0.0`. En tu máquina, tal como está el código, arranca en
loopback sin hacer nada.

## 9. Lo que sigue sin hacer

- **Desplegar las reglas de Firestore**: siguen sin aplicarse en Firebase
  (`firebase deploy --only firestore:rules` con tu cuenta).
- **Autenticación de la API local**: cualquiera con acceso al equipo puede llamar a
  `/api/v1/*`. Con el servidor en loopback el riesgo es el de la propia sesión; si se
  expone en red, hay que poner token o cerrar el puerto.
- **Persistencia**: `db.ts` sigue escribiendo JSON en `seeds/` sin bloqueo entre
  procesos. Es aceptable para una demo local; para uso real toca una base de datos.
- **Firma de código** del instalador y **release público** de `0.3.4-alpha`.
