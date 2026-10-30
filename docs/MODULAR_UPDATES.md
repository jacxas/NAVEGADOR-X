# Actualizaciones modulares — Navegador X

## Objetivo
Permitir que una mejora independiente llegue al usuario sin reinstalar Electron/Chromium. Se separa el ciclo de vida del núcleo del ciclo de vida de los datos y módulos compatibles.

## Dos canales

| Canal | Contenido | Instalación |
|---|---|---|
| Core updater | Electron, Chromium, proceso main, preload, binarios nativos, IPC y UI integrada | Nueva versión de escritorio; reinicio controlado |
| Feature updater | Reglas, filtros, configuración y traducciones declarativas | Descarga, verificación y activación sin reinstalar el core |

La versión web publicada en Pages/Vercel sigue el ciclo de despliegue web. No recibe paquetes de Electron; al desplegar una SPA se actualiza al publicar el nuevo bundle.

## Fase 1 — Paquetes declarativos
Sólo se aceptan artefactos rules, config y locale. Son datos, no código ejecutable. El contrato está en src/updates/manifest.ts.

Cada artefacto declara ID estable, versión SemVer, tipo permitido, rango minCoreVersion/maxCoreVersion, canal stable/beta, URL HTTPS, tamaño máximo 20 MiB, SHA-512 hexadecimal, permisos vacíos y fecha de publicación.

El validador rechaza IDs duplicados, versiones inválidas, rangos invertidos, HTTP, credenciales embebidas, hash mal formado, tamaños excesivos y permisos no vacíos.

## Fase 2 — Transporte y firma (pendiente)
1. Consultar catálogo alojado en GitHub Releases o endpoint HTTPS.
2. Descargar sólo a staging, nunca sobrescribir la versión activa.
3. Verificar firma Ed25519 del manifiesto en Electron main con clave pública embebida en el core.
4. Verificar SHA-512 del artefacto y tamaño real.
5. Comprobar producto, canal, SemVer y compatibilidad.
6. Activar mediante swap atómico y conservar la última versión funcional.
7. Ejecutar health-check del consumidor; revertir si falla.
8. Registrar versión, hash, fecha, resultado y rollback.

Un hash obtenido del mismo origen no autentica al publicador. La firma debe cubrir una representación canónica del manifiesto y todos los metadatos de cada artefacto.

## Fase 3 — Código de plugins (no habilitada)
No se descargará JavaScript/Node arbitrario ni se ejecutará con eval, require o import remoto ni acceso directo a Electron. Un plugin ejecutable requiere sandbox, permisos, revocación, API bridge, límites de recursos y rollback. WASM con WASI restringido podría evaluarse más adelante; no es automáticamente seguro.

BrowserKernel.registerPluginFromManifest recibe ejecutores ya presentes localmente. No descarga ni ejecuta plugins. El registro actual tampoco aísla código remoto.

## Fase 4 — Integración del Kernel (pendiente)
Antes de activar módulos desde el updater: ownership de capacidades por plugin, nombres únicos, unregister sólo de capacidades propias, hooks secuenciales y awaitables, bloqueo durante ejecución y eventos de instalación/activación/fallo/rollback.

## Estado real de esta rama
- [x] Contrato declarativo y validación estructural.
- [x] Comparación SemVer y compatibilidad del core.
- [x] Pruebas unitarias del contrato.
- [ ] Catálogo remoto y política de canales.
- [ ] Firma Ed25519 y verificación en Electron main.
- [ ] Descarga segura, staging y SHA-512 del archivo.
- [ ] Instalación atómica y rollback.
- [ ] UI de actualizaciones de funciones.
- [ ] Integración con consumidores reales.
- [ ] Auto-updater del core Electron/Chromium.

Esta rama establece el contrato y su validación, pero todavía no actualiza funciones en los equipos de los usuarios.
