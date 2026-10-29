# Bloque C — Interfaz y accesibilidad

Fecha: 2026-10-29 · Versión en el árbol: `0.3.4-alpha` (sin etiquetar)
Base: `main` en `eea77e7`

Este anexo cubre lo que quedaba de la auditoría de interfaz: barra duplicada, panel
cortado y accesibilidad. Todo lo que se afirma aquí se puede reproducir con los
comandos de la sección *Verificación*.

---

## 1. Barra duplicada

En la Edición de Escritorio había **dos barras de ventana**: la nativa
(`DesktopTitleBar`, con minimizar / maximizar / cerrar) y, debajo, la barra de
direcciones con tres puntos decorativos de estilo macOS que no hacían nada.

- `src/App.tsx`: los puntos solo se dibujan cuando **no** hay shell de escritorio
  (`!isDesktopApp()`), y se marcan `aria-hidden` porque son decoración.
- La barra de direcciones tenía además un prefijo fijo `navigatorx://` que se sumaba
  al valor del campo: con `navegador://dashboard` dentro, la lectura era
  `navigatorx://navegador://dashboard`. Se sustituyó por un icono del esquema real
  (interna / HTTPS / HTTP) con su descripción para lectores de pantalla.

## 2. Panel cortado

`AdminPanel` fijaba su alto en `calc(100vh - 64px)`, que no descuenta ni la barra de
pestañas ni la de direcciones: sobraba contenido por debajo del borde de la ventana.

- `src/components/AdminPanel.tsx`: `h-full min-h-0` y área de contenido con
  `min-h-0 flex-1 overflow-y-auto`, de modo que el scroll ocurre donde debe.
- `src/App.tsx` e `src/index.css`: la aplicación ocupa la altura real del contenedor
  (`h-dvh` + `html, body, #root { height: 100% }`) y el área de contenido usa
  `min-h-0`, que es lo que permite que un hijo con scroll no desborde el `flex`.

## 3. Accesibilidad

| Antes | Ahora |
|---|---|
| El foco de teclado era invisible: todos los componentes quitaban el contorno | Anillo de foco visible en `:focus-visible`, con color propio en Light Aura |
| Las pestañas eran `div` clicables sin rol | `tablist`/`tab` con `aria-selected`, `aria-controls`, flechas, Inicio/Fin y `Delete` para cerrar |
| Los botones de la barra lateral solo tenían un icono sin nombre | `aria-label`, `title` y `aria-current` en la pestaña activa |
| Los conmutadores (Privacy Shield, Descargas, X-Ray, IA) no comunicaban estado | `aria-pressed` |
| El aviso de minería y el modal de traducción no atrapaban el foco | `useFocusTrap`: foco atrapado, Escape cierra, el foco vuelve a quien abrió |
| `<html lang="en">` con la interfaz en español | `lang="es"` |
| No había forma de saltar la navegación con el teclado | Enlace «Saltar al contenido» |
| Animaciones siempre activas | `prefers-reduced-motion` en CSS y `MotionConfig reducedMotion="user"` en React |
| Los toasts de privacidad no se anunciaban | Región `role="status" aria-live="polite"` |
| «Historial» y «Ajustes» parecían funcionar y no hacían nada | Marcados como no disponibles (`disabled`, «pronto») |

Además, las sugerencias de la barra de direcciones se exponen como `listbox`/`option`
y el campo de dirección como `combobox` (`aria-expanded`, `aria-controls`,
`aria-autocomplete`).

## 4. Un fallo de navegación encontrado por las pruebas

`resolveUserInput` trataba cualquier `palabra:` como un esquema. Por eso
`localhost:3000` se devolvía tal cual y **nunca se abría**: acababa en el viewport como
texto sin esquema. Ahora solo se respetan como esquema las direcciones con `://`
(`https://`, `navegador://`, `runtime://`…) y una lista corta de esquemas sin
autoridad (`about:`, `data:`, `mailto:`, `tel:`, `file:`, `blob:`). El resto se
resuelve como dirección.

## 5. Pruebas automatizadas

Antes no había ninguna. Ahora hay **21 pruebas** con Vitest + Testing Library que
cubren lo que se rompió en auditorías anteriores:

- `src/lib/__tests__/navigation.test.ts` — resolución de la barra de direcciones,
  alias internos (`navegador://mineria` → `miner`) y clasificación del esquema.
- `src/lib/__tests__/a11y.test.tsx` — foco atrapado, ciclo de Tab, Escape y devolución
  del foco al cerrar.
- `src/components/__tests__/SessionTabBar.test.tsx` — roles, orden de tabulación,
  navegación con flechas y cierre con `Delete`.
- `src/__tests__/App.smoke.test.tsx` — montaje real de la aplicación con Firebase
  simulado: la barra de direcciones accesible existe, una búsqueda acaba en Google y
  `navegador://vpn` cambia de sección.

CI (`.github/workflows/ci.yml`) ejecuta `npm test` entre el typecheck y el build.

## 6. Dependencias

`npm audit` estaba en **22 vulnerabilidades (4 críticas, 12 altas)**. Tras `npm audit
fix` y subir Vitest 3 → 5 (la crítica venía de `tinypool`), quedan **6 (0 críticas, 4
altas)**:

| Paquete | Vía | Por qué sigue |
|---|---|---|
| `@grpc/grpc-js` | `firebase` | Solo se corrige con un salto mayor del SDK (`--force`) |
| `qs` | `express` | Idem |
| `esbuild` | `tsx` (solo desarrollo) | Requiere subir `tsx` de versión mayor |

Ninguna de las tres se ejecuta en el binario que usa el usuario final: son cadenas de
desarrollo o servidor local. Queda pendiente decidir si se asume el salto mayor.

## 7. Verificación

```
npm run lint        → tsc --noEmit, 0 errores
npm test            → 4 archivos, 21 pruebas, 21 correctas
npm run build       → build del renderer correcto
npm run build:electron → electron-dist/preload.cjs y main compilados
npm run dev         → HTTP 200 a través del host de vista previa; <html lang="es">
npm audit           → 6 vulnerabilidades (0 críticas, 4 altas)
```

Comprobación manual recomendada en la Edición de Escritorio:

1. La ventana muestra **una** barra de título y debajo la de direcciones sin puntos.
2. Pestañas: `←`/`→` cambian, `Inicio`/`Fin` van a los extremos, `Delete` cierra.
3. Minería → el aviso modal no deja tabular al fondo; `Escape` lo cierra y el foco
   vuelve al botón que lo abrió.
4. Administración → el contenido hace scroll dentro del panel, no se corta.

## 8. Lo que sigue sin hacer

- **Instalador y release**: `release.yml` compila desde el tag, pero aquí no hay
  Windows. Para publicar: merge de esta rama, `npm version 0.3.4-alpha` ya aplicado y
  `git tag v0.3.4-alpha && git push origin v0.3.4-alpha` (recordar la ruta corta de
  compilación por el límite de 260 caracteres de NSIS).
- **Firma de código**: sigue sin hacerse; Windows seguirá mostrando «editor
  desconocido».
- `server.ts`: sin tocar (el guardián de secretos sigue rechazando las líneas de
  `apiKey`). Escucha en `0.0.0.0:3000`; falta el parche manual o la regla de firewall.
- Reglas de Firestore: escritas en el repositorio, **sin desplegar**.
- Accesibilidad: se cubren foco, roles, teclado y movimiento reducido. No se ha hecho
  una auditoría WCAG completa de contraste en todos los paneles.
