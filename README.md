# Navegador X — Edición de Escritorio

**v0.3.3-alpha** · Windows x64 · Electron 44 / Chromium 152 · Licencia MIT

Navegador de escritorio con motor real (Chromium embebido), bloqueo de publicidad a nivel de red, proxy configurable, descargas a disco y **capacidad de instalar PWAs** como aplicaciones con acceso directo y ventana propia.

> Este README describe lo que el binario hace de verdad. Los paneles de minería, nodos VPN y anti-fingerprinting son **demostraciones de interfaz**; el proxy y el bloqueador **sí** actúan sobre la red.

## Descargar

**[Descargar Navegador X 0.3.1-alpha](https://github.com/jacxas/NAVEGADOR-X/releases/latest)** — instalador (`NavegadorX-Setup-0.3.1-alpha.exe`) y versión portable incluidos como assets del release.

Ramas: `main` = proyecto completo (web + kernel + edición Electron + scripts QA) · `hosted-preview` = variante web para servir en local.

> La edición web se sirve en tu máquina con `npm run dev` (http://127.0.0.1:3000).
> No hay sitio publicado: GitHub Pages no está habilitado en este repositorio.

---

## Qué incluye (verificado en ejecución)

| Función | Estado | Detalle |
|---|---|---|
| Navegación real | ✅ | `<webview>` con partición persistente, sandbox y aislamiento por proceso |
| Pestañas, atrás/adelante, recarga | ✅ | Estado y título reales del motor; latencia de carga medida en ms |
| Barra de direcciones | ✅ | Historial real con autocompletado; esquemas internos `navegador://` |
| Marcadores | ✅ | IndexedDB, con categoría y detección de duplicados |
| Descargas | ✅ | A disco con progreso, pausa, reanudación y cancelación |
| Bloqueador de anuncios | ✅ | ~185 reglas propias, cancelación real por `webRequest`; contadores verificables |
| Proxy | ✅ | SOCKS5 / SOCKS4 / HTTP / HTTPS (CONNECT), por sesión o por pestaña; autenticación en memoria |
| Chat de IA | ✅ | Gemini si hay clave; si no, motor local sin conexión. Conversación persistente |
| **Instalar PWA** | ✅ | Detecta el manifest y crea acceso directo + ventana independiente (`--app=`) |
| Panel de titularidad | ✅ | Autor, licencia, versión, runtime y rutas leídos del programa en ejecución |

**Prueba de plataforma web:** 55 de 70 capacidades de [WhatWebCanDo.today](https://whatwebcando.today) (service workers, offline, WebGPU, Bluetooth, USB, WebXR, cámara, micrófono). Las 15 restantes son límites de Chromium en Windows (NFC, SMS OTP, detección de formas, widgets), no del navegador.

---

## Instalación

1. Descarga `NavegadorX-Setup-<versión>.exe` (instalador) o `NavegadorX-Portable-<versión>.exe`.
2. Ejecútalo. Windows mostrará **«editor desconocido»** porque el binario no está firmado todavía: es lo esperado, no un error.
3. El instalador es por usuario (no pide administrador) y crea accesos en Escritorio y Menú Inicio.

**Requisitos:** Windows 10/11 x64. ~350 MB de RAM en uso normal con 3-4 pestañas.

---

## Instalar una PWA

1. Abre la web de una aplicación instalable (por ejemplo `https://excalidraw.com`).
2. Cuando la página declare un manifest, aparece el botón **⬇ Instalar** en la barra del navegador.
3. Al pulsarlo se crean accesos directos en el Escritorio y en el Menú Inicio. Cada uno abre la app en su propia ventana, sin pestañas ni barra lateral, compartiendo la sesión y el bloqueador del navegador.

Directorio recomendado para probar: [pwa.directory](https://pwa.directory).

---

## Desarrollo

```bash
npm install

npm run dev            # SPA en http://localhost:3000
npm run lint           # tsc --noEmit
npm test               # pruebas unitarias (Vitest + Testing Library)
npm run build          # build del renderer (Vite)

npm run desktop        # compila renderer + main y abre Electron
npm run package:win    # instalador NSIS + portable
npm run package:dir    # carpeta desempaquetada (sin instalador)
```

---

## Arquitectura

```
electron/
  main.ts        proceso principal: ventana, protocolo app://, proxy, bloqueador,
                 IA, descargas, instalación de PWAs y ventanas standalone
  preload.ts     único puente tipado (contextBridge) hacia la interfaz
  adblock.ts     motor de reglas por sufijo de dominio y comodines
src/
  kernel/        BrowserKernel, RuntimeScheduler y contratos congelados
  components/    interfaz: viewport, barra, paneles, chat, ajustes
  lib/           puente nativo, IndexedDB, servicios
```

Decisiones de seguridad: `contextIsolation`, `sandbox`, sin `nodeIntegration` en el renderer; la clave de Gemini nunca llega a la interfaz; el proxy se valida (esquema, host, puerto y patrón de partición).

---

## Límites conocidos

- **Sin firma de código**: SmartScreen avisa al instalar.
- **Sin actualizaciones automáticas**: cada versión se instala a mano.
- **Windows x64** únicamente por ahora.
- El bloqueador no elimina anuncios servidos desde el dominio del propio sitio ni aplica reglas cosméticas.
- Los paneles de minería, nodos VPN y anti-fingerprinting son simulaciones de interfaz.
- El icono del acceso directo de una PWA es el del navegador (convertir el icono del manifest a `.ico` está pendiente).

---

## Hoja de ruta

- Firma de código y actualizaciones automáticas.
- Icono propio por PWA instalada (PNG → ICO) y color de tema del manifest en la ventana.
- Reglas cosméticas de bloqueo y listas externas opcionales.
- Pruebas de humo automatizadas y CI de release.

## Licencia

MIT © 2026 cryptojacxas-ship-it. Consulta `LICENSE`.
