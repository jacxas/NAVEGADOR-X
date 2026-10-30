/**
 * Navegador X — Desktop Runtime Shell (Electron)
 * ==============================================
 * Proceso principal de la Edición de Escritorio (v0.2.0-alpha).
 *
 * Principios de diseño (alineados con ARCHITECTURE.md):
 *  - El kernel y sus contratos públicos NO se modifican: este shell solo añade
 *    capacidades nativas (viewport real, descargas a disco, ventana, IA).
 *  - contextIsolation + sandbox activos y nodeIntegration desactivado.
 *  - Los <webview> de contenido remoto se endurecen en `will-attach-webview`.
 *  - La SPA se sirve por el esquema propio `app://bundle` (origen estándar y seguro),
 *    de modo que localStorage, IndexedDB y Firebase funcionan igual que en la web.
 *  - Modo autónomo: sin GEMINI_API_KEY la app arranca y funciona igual; el motor
 *    de IA cae a un modo local sin red.
 */

import {
  app,
  BrowserWindow,
  Menu,
  MenuItemConstructorOptions,
  ipcMain,
  shell,
  session,
  protocol,
  dialog,
  safeStorage,
} from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import { AdBlocker } from './adblock';

// ---------------------------------------------------------------------------
// Constantes de entorno
// ---------------------------------------------------------------------------

const IS_DEV = process.env.NAVEGADOR_DEV === '1' || process.argv.includes('--dev');
const DEV_URL = process.env.NAVEGADOR_DEV_URL || 'http://localhost:3000';

/**
 * Modo de QA visual (solo para desarrollo y pruebas automatizadas):
 *  - NAVEGADORX_SCREENSHOT      → guarda una captura del panel inicial y sale.
 *  - NAVEGADORX_OPEN_URL        → abre esa URL en una pestaña antes de capturar.
 *  - NAVEGADORX_SCREENSHOT_WAIT → milisegundos de espera antes de la captura.
 */
const SCREENSHOT_PATH = process.env.NAVEGADORX_SCREENSHOT || '';
const SCREENSHOT_OPEN_URL = process.env.NAVEGADORX_OPEN_URL || '';
const SCREENSHOT_WAIT_MS = Number(process.env.NAVEGADORX_SCREENSHOT_WAIT || 4500);

const APP_SCHEME = 'app';
const APP_HOST = 'bundle';
const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;
const APP_ENTRY = `${APP_ORIGIN}/index.html`;

/** Partición persistente compartida por todas las pestañas: cookies y sesión reales. */
const BROWSER_PARTITION = 'persist:navegadorx';

const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function distDir(): string {
  return path.join(app.getAppPath(), 'dist');
}

function rendererUrl(): string {
  return IS_DEV ? DEV_URL : APP_ENTRY;
}

function userDataFile(name: string): string {
  return path.join(app.getPath('userData'), name);
}

interface ShellSettings {
  /** Legado: versiones anteriores guardaban la clave en claro. Solo se lee para migrar. */
  geminiApiKey?: string;
  /** Clave cifrada con el almacén del sistema (base64). */
  geminiSecretEnc?: string;
  geminiModel?: string;
  aiMode?: 'local' | 'cloud' | 'hybrid';
  ollamaModel?: string;
}

function readSettings(): ShellSettings {
  try {
    const raw = fs.readFileSync(userDataFile('settings.json'), 'utf-8');
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function writeSettings(next: ShellSettings): void {
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.writeFileSync(userDataFile('settings.json'), JSON.stringify(next, null, 2), 'utf-8');
  } catch (error) {
    console.error('[NavegadorX] No se pudieron guardar los ajustes:', error);
  }
}

/**
 * Cifra un secreto con el almacén del sistema (DPAPI en Windows, Keychain en
 * macOS, libsecret en Linux). Devuelve `null` si el sistema no lo ofrece.
 */
function encryptSecret(value: string): string | null {
  try {
    if (!safeStorage.isEncryptionAvailable()) return null;
    return safeStorage.encryptString(value).toString('base64');
  } catch (error) {
    console.warn('[NavegadorX] No se pudo cifrar el secreto:', error);
    return null;
  }
}

function decryptSecret(payload: string): string {
  try {
    return safeStorage.decryptString(Buffer.from(payload, 'base64'));
  } catch (error) {
    console.warn('[NavegadorX] No se pudo descifrar el secreto:', error);
    return '';
  }
}

/**
 * Migración única: las versiones anteriores guardaban la clave del modelo en
 * claro dentro de `settings.json`. Al arrancar se cifra y se borra el original.
 * Si el sistema no ofrece cifrado, el fichero se deja como está y se avisa.
 */
function migratePlaintextSecrets(): void {
  const settings = readSettings();
  if (!settings.geminiApiKey) return;
  const encrypted = encryptSecret(settings.geminiApiKey);
  if (!encrypted) {
    console.warn('[NavegadorX] Sin almacén cifrado: la clave heredada no se puede migrar.');
    return;
  }
  settings.geminiSecretEnc = encrypted;
  delete settings.geminiApiKey;
  writeSettings(settings);
  console.log('[NavegadorX] Clave del modelo migrada al almacén cifrado del sistema.');
}

/** Clave efectiva: variable de entorno primero, luego ajustes guardados. */
function geminiApiKey(): string {
  const fromEnv = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();
  const stored = readSettings();
  if (stored.geminiSecretEnc) {
    const decrypted = decryptSecret(stored.geminiSecretEnc).trim();
    if (decrypted) return decrypted;
  }
  // Compatibilidad con el formato anterior, solo mientras se migra.
  return stored.geminiApiKey && stored.geminiApiKey.trim() ? stored.geminiApiKey.trim() : '';
}

function geminiModel(): string {
  return readSettings().geminiModel || DEFAULT_GEMINI_MODEL;
}

type AiMode = 'local' | 'cloud' | 'hybrid';

function configuredAiMode(): AiMode {
  const mode = readSettings().aiMode;
  return mode === 'cloud' || mode === 'hybrid' ? mode : 'local';
}

function configuredOllamaModel(): string {
  const model = (readSettings().ollamaModel || process.env.OLLAMA_MODEL || 'qwen2.5:7b').trim();
  if (!/^[a-zA-Z0-9._:-]{1,128}$/.test(model)) throw new Error('El nombre del modelo Ollama no es válido.');
  return model;
}

function isSafeExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' || parsed.protocol === 'mailto:';
  } catch {
    return false;
  }
}

async function openExternalSafely(url: string): Promise<boolean> {
  if (!isSafeExternalUrl(url)) {
    console.warn('[NavegadorX] URL externa rechazada por seguridad:', url);
    return false;
  }
  await shell.openExternal(url);
  return true;
}

/** Esquemas internos que un `<webview>` puede cargar además de la web. */
const INTERNAL_WEBVIEW_SCHEMES = ['navegador:', 'runtime:'];

/**
 * Lista blanca para `<webview>`: web real, el bundle de la app y las páginas
 * internas del producto. Cualquier otro esquema (`file:`, `data:`, `javascript:`)
 * se rechaza antes de que el elemento llegue a adjuntarse.
 */
function isAllowedWebviewUrl(url: string): boolean {
  if (url.startsWith(APP_ORIGIN)) return true;
  if (isSafeExternalUrl(url)) return true;
  try {
    return INTERNAL_WEBVIEW_SCHEMES.includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  }
}

// ---------------------------------------------------------------------------
// Motor de IA (modo autónomo: funciona sin clave)
// ---------------------------------------------------------------------------

interface AiResult {
  response: string;
  provider: string;
  offline: boolean;
}

async function callOllamaDesktop(
  prompt: string,
  options: { systemInstruction?: string; temperature?: number } = {},
): Promise<AiResult> {
  if (!prompt.trim() || prompt.length > 8_000) throw new Error('La consulta está vacía o supera 8000 caracteres.');
  const model = configuredOllamaModel();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch('http://127.0.0.1:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          ...(options.systemInstruction ? [{ role: 'system', content: options.systemInstruction }] : []),
          { role: 'user', content: prompt },
        ],
        options: { temperature: options.temperature ?? 0.7 },
      }),
    });
    if (!response.ok) throw new Error(`Ollama respondió HTTP ${response.status}.`);
    const payload = await response.json() as { message?: { content?: unknown } };
    const answer = payload?.message?.content;
    if (typeof answer !== 'string' || !answer.trim()) throw new Error('Ollama devolvió una respuesta vacía.');
    return { response: answer, provider: `Ollama (${model})`, offline: true };
  } finally {
    clearTimeout(timeout);
  }
}

async function callGemini(
  contents: string,
  options: { systemInstruction?: string; temperature?: number } = {},
): Promise<AiResult> {
  const credencial = geminiApiKey();
  if (!credencial) throw new Error('Gemini no está configurado. Selecciona modo local o configura una clave para usar cloud.');

  const model = geminiModel();

  // La clave viaja como parámetro de consulta, que es el método de autenticación
  // documentado por la API de Gemini. Su valor sale del entorno o del fichero de
  // ajustes del usuario: nunca está escrito en el código ni en el repositorio.
  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent` +
    `?key=${encodeURIComponent(credencial)}`;

  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: contents }] }],
    generationConfig: { temperature: options.temperature ?? 0.7 },
  };
  if (options.systemInstruction) {
    body.systemInstruction = { parts: [{ text: options.systemInstruction }] };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Gemini respondió ${response.status}: ${detail.slice(0, 300)}`);
    }

    const payload: any = await response.json();
    const text: string =
      payload?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || '').join('') || '';

    return {
      response: text || 'El motor de IA no devolvió contenido.',
      provider: `Gemini (${model})`,
      offline: false,
    };
  } catch (error: any) {
    console.error('[NavegadorX] Error al consultar Gemini:', error);
    throw new Error(`Gemini no respondió correctamente: ${error?.message || String(error)}`);
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Gestor de descargas reales a disco
// ---------------------------------------------------------------------------

type DownloadState = 'progressing' | 'paused' | 'completed' | 'cancelled' | 'interrupted';

interface DownloadRecord {
  id: string;
  filename: string;
  url: string;
  savePath: string;
  totalBytes: number;
  receivedBytes: number;
  state: DownloadState;
  startedAt: number;
  endedAt?: number;
  speedBps: number;
  percent: number;
}

interface DownloadEntry {
  item: Electron.DownloadItem;
  record: DownloadRecord;
  lastSampleAt: number;
  lastSampleBytes: number;
}

const downloads = new Map<string, DownloadEntry>();

/** Evita sobrescribir ficheros existentes: informe.pdf → informe (1).pdf */
function uniqueSavePath(dir: string, filename: string): string {
  const safeName = filename.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_') || 'descarga';
  const parsed = path.parse(safeName);
  let candidate = path.join(dir, safeName);
  let counter = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${parsed.name} (${counter})${parsed.ext}`);
    counter += 1;
  }
  return candidate;
}

function updateDownload(entry: DownloadEntry, patch: Partial<DownloadRecord>, stateOverride?: DownloadState): void {
  entry.record = { ...entry.record, ...patch };
  if (stateOverride) entry.record.state = stateOverride;
  broadcast('download:update', entry.record);
}

function attachDownloadHandler(target: Electron.Session): void {
  target.on('will-download', (_event, item) => {
    const id = `dl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const filename = item.getFilename() || 'descarga';
    const savePath = uniqueSavePath(app.getPath('downloads'), filename);

    item.setSavePath(savePath);

    const record: DownloadRecord = {
      id,
      filename,
      url: item.getURL(),
      savePath,
      totalBytes: item.getTotalBytes(),
      receivedBytes: 0,
      state: 'progressing',
      startedAt: Date.now(),
      speedBps: 0,
      percent: 0,
    };

    const entry: DownloadEntry = {
      item,
      record,
      lastSampleAt: Date.now(),
      lastSampleBytes: 0,
    };
    downloads.set(id, entry);
    broadcast('download:update', record);

    item.on('updated', (_e, state) => {
      const now = Date.now();
      const received = item.getReceivedBytes();
      const total = item.getTotalBytes();

      const elapsed = now - entry.lastSampleAt;
      let speed = entry.record.speedBps;
      if (elapsed >= 400) {
        speed = Math.max(0, Math.round(((received - entry.lastSampleBytes) * 1000) / elapsed));
        entry.lastSampleAt = now;
        entry.lastSampleBytes = received;
      }

      const nextState: DownloadState = item.isPaused()
        ? 'paused'
        : state === 'interrupted'
          ? 'interrupted'
          : 'progressing';

      updateDownload(
        entry,
        {
          receivedBytes: received,
          totalBytes: total,
          speedBps: speed,
          percent: total > 0 ? Math.min(100, (received / total) * 100) : 0,
        },
        nextState,
      );
    });

    item.once('done', (_e, state) => {
      const finalState: DownloadState =
        state === 'completed' ? 'completed' : state === 'cancelled' ? 'cancelled' : 'interrupted';

      updateDownload(
        entry,
        {
          receivedBytes: item.getReceivedBytes(),
          totalBytes: item.getTotalBytes(),
          endedAt: Date.now(),
          speedBps: 0,
          percent:
            item.getTotalBytes() > 0
              ? Math.min(100, (item.getReceivedBytes() / item.getTotalBytes()) * 100)
              : entry.record.percent,
        },
        finalState,
      );
    });
  });
}

// ---------------------------------------------------------------------------
// Protocolo app://bundle — sirve la SPA compilada
// ---------------------------------------------------------------------------

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
};

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

function registerAppProtocol(): void {
  const root = path.resolve(distDir());

  protocol.handle(APP_SCHEME, async (request) => {
    try {
      const url = new URL(request.url);
      let relative = decodeURIComponent(url.pathname);
      if (!relative || relative === '/') relative = '/index.html';

      const resolved = path.resolve(path.join(root, relative));
      const insideRoot = resolved === root || resolved.startsWith(root + path.sep);

      if (!insideRoot) {
        return new Response('Forbidden', { status: 403 });
      }

      let target = resolved;
      try {
        const stat = await fsp.stat(target);
        if (stat.isDirectory()) target = path.join(target, 'index.html');
      } catch {
        // Ruta desconocida: la SPA no usa router de URL, así que servimos el índice.
        target = path.join(root, 'index.html');
      }

      const data = await fsp.readFile(target);
      const contentType = MIME_TYPES[path.extname(target).toLowerCase()] || 'application/octet-stream';
      return new Response(data, { headers: { 'Content-Type': contentType } });
    } catch (error) {
      console.error('[NavegadorX] Error sirviendo app://', error);
      return new Response('Not found', { status: 404 });
    }
  });
}

// ---------------------------------------------------------------------------
// Endurecimiento de sesiones y webviews
// ---------------------------------------------------------------------------

/** Permisos que sí aceptamos de las webs visitadas; el resto se deniega. */
const ALLOWED_PERMISSIONS = new Set(['fullscreen', 'clipboard-sanitized-write', 'pointerLock']);

function hardenSession(target: Electron.Session): void {
  target.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(ALLOWED_PERMISSIONS.has(permission));
  });

  target.setPermissionCheckHandler((_wc, permission) => ALLOWED_PERMISSIONS.has(permission));

  target.setUserAgent(target.getUserAgent().replace(/Electron\/[\d.]+ /, '').replace(/Navegador X\/[\d.]+ /, ''));
}

/** Hosts de proveedores de identidad que sí pueden abrir una ventana hija propia. */
const AUTH_POPUP_HOSTS = ['accounts.google.com', 'accounts.youtube.com', 'apis.google.com'];
const AUTH_POPUP_SUFFIXES = ['.firebaseapp.com', '.googleusercontent.com', '.gstatic.com'];

/**
 * ¿Es una URL del flujo de inicio de sesión?
 *
 * Firebase abre el acceso con Google en una ventana emergente y necesita conservar
 * `window.opener` para devolver la credencial. Si esa ventana se enviara al navegador
 * del sistema, el inicio de sesión nunca podría completarse, así que estos dominios
 * concretos se abren como ventana hija dentro de la aplicación.
 */
function isAuthPopup(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return AUTH_POPUP_HOSTS.includes(host) || AUTH_POPUP_SUFFIXES.some((suffix) => host.endsWith(suffix));
  } catch {
    return false;
  }
}

function registerWebContentsHardening(): void {
  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      // Ventanas de inicio de sesión: se abren dentro de la aplicación.
      if (isAuthPopup(url)) {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            width: 520,
            height: 700,
            autoHideMenuBar: true,
            backgroundColor: '#ffffff',
            webPreferences: {
              contextIsolation: true,
              nodeIntegration: false,
              sandbox: true,
              webSecurity: true,
            },
          },
        };
      }

      // Ventanas emergentes normales: se abren como pestaña dentro del navegador o en el SO.
      if (contents.getType() === 'webview' && isSafeExternalUrl(url)) {
        const host = contents.hostWebContents;
        if (host && !host.isDestroyed()) {
          host.send('navegador:command', { command: 'open-tab', url });
          return { action: 'deny' };
        }
      }
      if (isSafeExternalUrl(url)) {
        void openExternalSafely(url);
      }
      return { action: 'deny' };
    });

    if (contents.getType() === 'webview') {
      contents.on('will-navigate', (event, url) => {
        if (!isSafeExternalUrl(url)) {
          event.preventDefault();
          console.warn('[NavegadorX] Navegación bloqueada:', url);
        }
      });

      contents.setVisualZoomLevelLimits(1, 5).catch(() => {});
    }
  });
}

// ---------------------------------------------------------------------------
// Ventana principal
// ---------------------------------------------------------------------------

let mainWindow: BrowserWindow | null = null;

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 960,
    minHeight: 620,
    show: false,
    backgroundColor: '#05060a',
    titleBarStyle: 'hidden',
    autoHideMenuBar: true,
    title: 'Navegador X',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: true,
      spellcheck: false,
      allowRunningInsecureContent: false,
    },
  });

  // Endurecimiento de los <webview> incrustados.
  win.webContents.on('will-attach-webview', (event, webPreferences, params) => {
    delete (webPreferences as any).preload;
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
    (webPreferences as any).sandbox = true;
    webPreferences.webSecurity = true;
    webPreferences.allowRunningInsecureContent = false;

    const src = params.src || '';
    if (src && !isAllowedWebviewUrl(src)) {
      console.warn('[NavegadorX] webview con origen no permitido (bloqueado):', src);
      event.preventDefault();
    }
  });

  // La ventana del shell nunca debe navegar fuera de la aplicación.
  win.webContents.on('will-navigate', (event, url) => {
    const allowed = IS_DEV ? url.startsWith(DEV_URL) : url.startsWith(APP_ORIGIN);
    if (!allowed) {
      event.preventDefault();
      void openExternalSafely(url);
    }
  });

  win.once('ready-to-show', () => win.show());

  win.on('maximize', () => win.webContents.send('window:maximized-changed', true));
  win.on('unmaximize', () => win.webContents.send('window:maximized-changed', false));
  win.on('enter-full-screen', () => win.webContents.send('window:fullscreen-changed', true));
  win.on('leave-full-screen', () => win.webContents.send('window:fullscreen-changed', false));
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });

  void win.loadURL(rendererUrl());

  if (IS_DEV) {
    win.webContents.openDevTools({ mode: 'detach' });
  }

  if (SCREENSHOT_PATH) {
    setupScreenshotRun(win);
  }

  return win;
}

/**
 * Sesión de captura para pruebas automatizadas: espera a que la interfaz cargue,
 * abre opcionalmente una URL y guarda un PNG del contenido real de la ventana.
 */
function setupScreenshotRun(win: BrowserWindow): void {
  win.webContents.once('did-finish-load', () => {
    setTimeout(async () => {
      try {
        if (SCREENSHOT_OPEN_URL) {
          win.webContents.send('navegador:command', { command: 'open-tab', url: SCREENSHOT_OPEN_URL });
          await new Promise((resolve) => setTimeout(resolve, SCREENSHOT_WAIT_MS));
        }

        const image = await win.webContents.capturePage();
        await fsp.mkdir(path.dirname(SCREENSHOT_PATH), { recursive: true });
        await fsp.writeFile(SCREENSHOT_PATH, image.toPNG());
        console.log(`[NavegadorX] Captura guardada en ${SCREENSHOT_PATH}`);
      } catch (error) {
        console.error('[NavegadorX] Falló la captura de QA:', error);
      } finally {
        app.exit(0);
      }
    }, SCREENSHOT_OPEN_URL ? 2500 : SCREENSHOT_WAIT_MS);
  });
}

// ---------------------------------------------------------------------------
// Menú de aplicación
// ---------------------------------------------------------------------------

function sendCommand(command: string, payload: Record<string, unknown> = {}): void {
  const win = BrowserWindow.getFocusedWindow() || mainWindow;
  if (win && !win.isDestroyed()) {
    win.webContents.send('navegador:command', { command, ...payload });
  }
}

function buildMenu(): void {
  const isMac = process.platform === 'darwin';

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? ([{ role: 'appMenu' }] as MenuItemConstructorOptions[])
      : ([
          {
            label: 'Archivo',
            submenu: [
              { label: 'Nueva pestaña', accelerator: 'CmdOrCtrl+T', click: () => sendCommand('new-tab') },
              { label: 'Cerrar pestaña', accelerator: 'CmdOrCtrl+W', click: () => sendCommand('close-tab') },
              { type: 'separator' },
              { label: 'Descargas', accelerator: 'CmdOrCtrl+J', click: () => sendCommand('toggle-downloads') },
              { type: 'separator' },
              { role: 'quit', label: 'Salir' },
            ],
          },
        ] as MenuItemConstructorOptions[])),
    {
      label: 'Editar',
      submenu: [
        { role: 'undo', label: 'Deshacer' },
        { role: 'redo', label: 'Rehacer' },
        { type: 'separator' },
        { role: 'cut', label: 'Cortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Pegar' },
        { role: 'selectAll', label: 'Seleccionar todo' },
      ],
    },
    {
      label: 'Navegar',
      submenu: [
        { label: 'Atrás', accelerator: 'Alt+Left', click: () => sendCommand('back') },
        { label: 'Adelante', accelerator: 'Alt+Right', click: () => sendCommand('forward') },
        { label: 'Recargar', accelerator: 'CmdOrCtrl+R', click: () => sendCommand('reload') },
        { label: 'Detener', accelerator: 'Esc', click: () => sendCommand('stop') },
        { type: 'separator' },
        { label: 'Ir a la barra de direcciones', accelerator: 'CmdOrCtrl+L', click: () => sendCommand('focus-url') },
        { label: 'Inicio', accelerator: 'Alt+Home', click: () => sendCommand('home') },
      ],
    },
    {
      label: 'Ver',
      submenu: [
        { role: 'reload', label: 'Recargar interfaz' },
        { role: 'forceReload', label: 'Forzar recarga de la interfaz' },
        { role: 'toggleDevTools', label: 'Herramientas de desarrollo' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Tamaño original' },
        { role: 'zoomIn', label: 'Ampliar' },
        { role: 'zoomOut', label: 'Reducir' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Pantalla completa' },
      ],
    },
    {
      label: 'Ayuda',
      submenu: [
        {
          label: 'Repositorio en GitHub',
          click: () => void openExternalSafely('https://github.com/cryptojacxas-ship-it/NAVEGADOR-X'),
        },
        {
          label: 'Acerca de Navegador X',
          click: () => {
            const win = BrowserWindow.getFocusedWindow() || mainWindow;
            const options = {
              type: 'info' as const,
              title: 'Acerca de Navegador X',
              message: `Navegador X — Edición de Escritorio ${app.getVersion()}`,
              detail:
                `Runtime OS ${process.env.npm_package_version || ''}\n` +
                `Electron ${process.versions.electron}\n` +
                `Chromium ${process.versions.chrome}\n` +
                `Node ${process.versions.node}\n\n` +
                'Motor de navegación real: descargas a disco, sesión persistente y proxy de red verificable.\n' +
                'El proxy sí cambia tu conexión; los nodos VPN, la minería y el anti-fingerprinting son demostraciones de interfaz.',
              buttons: ['Cerrar'],
            };
            if (win) void dialog.showMessageBox(win, options);
            else void dialog.showMessageBox(options);
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------------------------------------------------------------------------
// Red: proxy real aplicado a la sesión del navegador (Fase 3)
// ---------------------------------------------------------------------------

/** Esquemas de proxy aceptados. No se admiten reglas PAC ni cadenas arbitrarias. */
const PROXY_SCHEMES = new Set(['socks5', 'socks4', 'http', 'https']);

interface ProxySetting {
  scheme: string;
  host: string;
  port: number;
}

/** Datos de acceso, si el proxy exige autenticación. Se guardan solo en memoria. */
interface ProxyAuth {
  usuario: string;
  clave: string;
}

let activeProxy: ProxySetting | null = null;
let proxyCredentials: ProxyAuth | null = null;

/**
 * Particiones de sesión permitidas.
 *
 * La compartida (`persist:navegadorx`) mantiene la sesión de todas las pestañas.
 * Una partición dedicada (`persist:navegadorx-tab-…`) da a una pestaña su propia
 * cookie jar y su propia ruta de red, que es lo que permite enrutar por pestaña.
 * El patrón evita que el renderer pueda crear sesiones arbitrarias.
 */
const SHARED_PARTITION = BROWSER_PARTITION;
const PARTITION_PATTERN = /^persist:navegadorx(-tab-[a-zA-Z0-9_-]{1,40})?$/;

/** Sesión compartida por todas las pestañas del navegador. */
function browserSession(): Electron.Session {
  return session.fromPartition(SHARED_PARTITION);
}

/** Resuelve una partición concreta, validando el nombre. */
function sessionFor(partition?: string): Electron.Session | null {
  const name = typeof partition === 'string' && partition ? partition : SHARED_PARTITION;
  if (!PARTITION_PATTERN.test(name)) return null;
  return session.fromPartition(name);
}

/** Lista de bloqueo importada por el usuario, guardada en su directorio de datos. */
const CUSTOM_LIST_FILE = 'adblock-custom.txt';

const adBlocker = new AdBlocker();

/** Prepara una partición recién creada: mismas reglas que la sesión compartida. */
function prepareSession(name: string): Electron.Session | null {
  if (!PARTITION_PATTERN.test(name)) return null;
  const target = session.fromPartition(name);
  hardenSession(target);
  attachDownloadHandler(target);
  attachBlocker(target, name);
  return target;
}

/**
 * Conecta el bloqueador a una sesión.
 *
 * Se registra una sola vez por sesión y actúa sobre todo menos el documento
 * principal: un anuncio se bloquea, pero nunca se impide cargar la página en sí.
 */
function attachBlocker(target: Electron.Session, partition: string): void {
  target.webRequest.onBeforeRequest(
    {
      urls: ['<all_urls>'],
      types: [
        'subFrame',
        'stylesheet',
        'script',
        'image',
        'font',
        'object',
        'xhr',
        'ping',
        'cspReport',
        'media',
        'webSocket',
      ],
    },
    (details, callback) => {
      const decision = adBlocker.shouldBlock(details.url);
      if (decision.block) {
        adBlocker.record(decision.host, partition);
        callback({ cancel: true });
        return;
      }
      callback({ cancel: false });
    },
  );
}

/** Recupera la lista importada por el usuario, si la hay. */
async function loadCustomBlocklist(): Promise<void> {
  try {
    const file = path.join(app.getPath('userData'), CUSTOM_LIST_FILE);
    const content = await fsp.readFile(file, 'utf-8');
    const applied = adBlocker.setCustomList(content, file);
    console.log(`[NavegadorX] Lista de bloqueo propia cargada: ${applied} reglas`);
  } catch {
    // Sin lista propia: se usa solo la incluida.
  }
}

function isValidProxyHost(host: string): boolean {
  if (host.length === 0 || host.length > 253) return false;
  if (/^\[[0-9a-fA-F:]+\]$/.test(host)) return true; // IPv6 entre corchetes
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true; // IPv4
  return /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/.test(host);
}

/**
 * Electron pide credenciales mediante el evento `login`. Solo respondemos a peticiones
 * de proxy y únicamente con los datos introducidos en esta sesión: nunca se escriben
 * en disco.
 */
function registerProxyAuthHandler(): void {
  app.on('login', (event, _webContents, _details, authInfo, callback) => {
    if (authInfo.isProxy && proxyCredentials) {
      event.preventDefault();
      callback(proxyCredentials.usuario, proxyCredentials.clave);
    }
  });
}

// ---------------------------------------------------------------------------
// Canales IPC
// ---------------------------------------------------------------------------

function registerIpcHandlers(): void {
  ipcMain.handle('app:get-info', () => {
    // Metadatos reales del paquete: son la base de la documentación de titularidad.
    let pkg: Record<string, any> = {};
    try {
      pkg = JSON.parse(fs.readFileSync(path.join(app.getAppPath(), 'package.json'), 'utf-8'));
    } catch {
      // Sin package.json legible se devuelven solo los datos del runtime.
    }

    return {
      name: pkg.productName || pkg.name || 'Navegador X',
      version: app.getVersion(),
      isPackaged: app.isPackaged,
      platform: process.platform,
      arch: process.arch,
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      downloadsPath: app.getPath('downloads'),
      userDataPath: app.getPath('userData'),
      author: typeof pkg.author === 'string' ? pkg.author : pkg.author?.name || null,
      license: pkg.license || null,
      homepage: pkg.homepage || null,
      description: pkg.description || null,
      repository: pkg.repository?.url || pkg.repository || null,
      appPath: app.getAppPath(),
    };
  });

  ipcMain.handle('app:open-external', async (_event, url: string) => openExternalSafely(url));
  ipcMain.handle('app:show-item-in-folder', (_event, target: string) => {
    if (typeof target === 'string' && target) shell.showItemInFolder(target);
  });
  ipcMain.handle('app:open-downloads-folder', async () => {
    await shell.openPath(app.getPath('downloads'));
  });
  ipcMain.handle('app:relaunch', () => {
    app.relaunch();
    app.exit(0);
  });

  // Ventana
  ipcMain.on('window:minimize', () => (BrowserWindow.getFocusedWindow() || mainWindow)?.minimize());
  ipcMain.on('window:maximize-toggle', () => {
    const win = BrowserWindow.getFocusedWindow() || mainWindow;
    if (!win) return;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  ipcMain.on('window:close', () => (BrowserWindow.getFocusedWindow() || mainWindow)?.close());
  ipcMain.handle('window:is-maximized', () => (BrowserWindow.getFocusedWindow() || mainWindow)?.isMaximized() ?? false);

  // IA — disponible desde el proceso principal, sin exponer la clave al renderer.
  ipcMain.handle('ai:has-key', () => Boolean(geminiApiKey()));
  ipcMain.handle('ai:model', () => geminiModel());
  ipcMain.handle('ai:mode', () => configuredAiMode());
  ipcMain.handle('ai:set-mode', (_event, mode: AiMode) => {
    if (mode !== 'local' && mode !== 'cloud' && mode !== 'hybrid') {
      return { ok: false, mode: configuredAiMode(), reason: 'Modo de IA no válido.' };
    }
    const settings = readSettings();
    settings.aiMode = mode;
    writeSettings(settings);
    return { ok: true, mode };
  });
  ipcMain.handle('ai:set-key', (_event, credencial: string, model?: string) => {
    const settings = readSettings();
    if (typeof credencial === 'string') {
      const value = credencial.trim();
      if (value) {
        const encrypted = encryptSecret(value);
        if (!encrypted) {
          return {
            ok: false,
            reason: 'Este sistema no ofrece almacenamiento cifrado; la clave no se ha guardado.',
            hasKey: Boolean(geminiApiKey()),
            model: geminiModel(),
          };
        }
        settings.geminiSecretEnc = encrypted;
        delete settings.geminiApiKey;
      } else {
        delete settings.geminiSecretEnc;
        delete settings.geminiApiKey;
      }
    }
    if (typeof model === 'string' && model.trim()) {
      settings.geminiModel = model.trim();
    }
    writeSettings(settings);
    return { ok: true, hasKey: Boolean(geminiApiKey()), model: geminiModel() };
  });
  ipcMain.handle(
    'ai:query',
    async (_event, prompt: string, options?: { systemInstruction?: string; temperature?: number; mode?: AiMode }) => {
      const systemInstruction =
        options?.systemInstruction ||
        "Eres la IA contextual e integrada del microkernel 'X Runtime OS' / 'Navegador X'. Responde de forma concisa y profesional.";
      const mode = options?.mode || configuredAiMode();

      if (mode === 'local' || mode === 'hybrid') {
        try {
          return await callOllamaDesktop(prompt, { systemInstruction, temperature: options?.temperature });
        } catch (error) {
          if (mode === 'local') {
            throw new Error('Ollama no está disponible. No se enviaron datos a la nube. Instala/inicia Ollama y descarga el modelo configurado.');
          }
          console.warn('[NavegadorX] Ollama no disponible; se usa Gemini por modo híbrido explícito.', error);
        }
      }

      return callGemini(prompt, { systemInstruction, temperature: options?.temperature });
    },
  );
  ipcMain.handle('ai:translate', async (_event, url: string, targetLanguage: string, pageContent?: string) => {
    const prompt =
      `Eres el traductor instantáneo inteligente integrado en el navegador 'Navegador X'.\n\n` +
      `Traducción requerida:\n- URL del sitio web: ${url || 'Pestaña Activa de Navegador X'}\n` +
      `- Idioma de destino: ${targetLanguage}\n` +
      `${pageContent ? `- Contenido extraído del sitio:\n${pageContent}` : ''}\n\n` +
      `Responde en Markdown con:\n1. **Resumen de la Página**\n2. **Titular Traducido**\n` +
      `3. **Contenido Principal Traducido**\n4. **Highlights / Menú de Navegación Traducido**`;

    const result = await callGemini(prompt, { temperature: 0.3 });
    return {
      success: !result.offline,
      translatedContent: result.response,
      provider: result.provider,
      targetLanguage,
      url,
      offline: result.offline,
    };
  });

  // Descargas
  ipcMain.handle('downloads:list', () => Array.from(downloads.values()).map((entry) => entry.record));
  ipcMain.handle('downloads:control', (_event, id: string, action: 'pause' | 'resume' | 'cancel' | 'retry') => {
    const entry = downloads.get(id);
    if (!entry) return { ok: false, reason: 'not-found' };

    try {
      if (action === 'pause') entry.item.pause();
      else if (action === 'resume') entry.item.resume();
      else if (action === 'cancel') entry.item.cancel();
      else if (action === 'retry') {
        const win = BrowserWindow.getFocusedWindow() || mainWindow;
        void win?.webContents.downloadURL(entry.record.url);
      }
      return { ok: true };
    } catch (error: any) {
      return { ok: false, reason: error?.message || String(error) };
    }
  });
  ipcMain.handle('downloads:open-file', async (_event, id: string) => {
    const entry = downloads.get(id);
    if (!entry || entry.record.state !== 'completed') return { ok: false };
    const error = await shell.openPath(entry.record.savePath);
    return { ok: !error, reason: error || undefined };
  });
  ipcMain.handle('downloads:show-in-folder', (_event, id: string) => {
    const entry = downloads.get(id);
    if (!entry) return { ok: false };
    shell.showItemInFolder(entry.record.savePath);
    return { ok: true };
  });
  ipcMain.handle('downloads:clear-finished', () => {
    for (const [id, entry] of downloads) {
      if (entry.record.state !== 'progressing' && entry.record.state !== 'paused') {
        downloads.delete(id);
      }
    }
    return Array.from(downloads.values()).map((entry) => entry.record);
  });
  ipcMain.on('downloads:start', (_event, url: string) => {
    if (!isSafeExternalUrl(url)) return;
    const win = BrowserWindow.getFocusedWindow() || mainWindow;
    void win?.webContents.downloadURL(url);
  });

  // Métricas reales del sistema para el Runtime Inspector
  ipcMain.handle('system:metrics', () => {
    const metrics = app.getAppMetrics();
    const totalMemoryKb = metrics.reduce((acc, m) => acc + (m.memory?.workingSetSize || 0), 0);
    const totalCpu = metrics.reduce((acc, m) => acc + (m.cpu?.percentCPUUsage || 0), 0);

    return {
      processes: metrics.map((m) => ({
        pid: m.pid,
        type: m.type,
        cpuPercent: Number((m.cpu?.percentCPUUsage || 0).toFixed(2)),
        memoryMb: Number(((m.memory?.workingSetSize || 0) / 1024).toFixed(1)),
      })),
      totalMemoryMb: Number((totalMemoryKb / 1024).toFixed(1)),
      totalCpuPercent: Number(totalCpu.toFixed(2)),
      system: {
        freeMemoryMb: Number((os.freemem() / 1024 / 1024).toFixed(1)),
        totalMemoryMb: Number((os.totalmem() / 1024 / 1024).toFixed(1)),
        cpuCount: os.cpus().length,
        uptimeSeconds: Math.round(os.uptime()),
        platform: `${os.type()} ${os.release()}`,
      },
      downloadsActive: Array.from(downloads.values()).filter((e) => e.record.state === 'progressing').length,
      sampledAt: Date.now(),
    };
  });

  // Red: proxy real, aplicable a la sesión compartida o a una pestaña concreta.
  ipcMain.handle('proxy:ensure', (_event, partition?: string) => {
    const name = typeof partition === 'string' && partition ? partition : SHARED_PARTITION;
    const prepared = prepareSession(name);
    return { ok: Boolean(prepared), partition: name };
  });

  ipcMain.handle('proxy:status', async (_event, partition?: string) => {
    const target = sessionFor(partition);
    if (!target) return { configured: null, resolved: '', hasCredentials: false, error: 'Partición no válida' };
    try {
      const resolved = await target.resolveProxy('https://www.google.com/');
      return { configured: activeProxy, resolved, hasCredentials: Boolean(proxyCredentials) };
    } catch (error: any) {
      return { configured: activeProxy, resolved: '', error: error?.message || String(error) };
    }
  });

  ipcMain.handle(
    'proxy:apply',
    async (
      _event,
      config: { partition?: string; scheme?: string; host?: string; port?: number | string; remember?: boolean },
    ) => {
      const target = sessionFor(config?.partition);
      if (!target) return { ok: false, reason: 'Partición no válida' };

      const scheme = String(config?.scheme ?? 'socks5').toLowerCase();
      const host = String(config?.host ?? '').trim();
      const port = Number(config?.port);

      if (!PROXY_SCHEMES.has(scheme)) return { ok: false, reason: `Esquema no soportado: ${scheme}` };
      if (!isValidProxyHost(host)) return { ok: false, reason: 'Dirección no válida' };
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        return { ok: false, reason: 'El puerto debe estar entre 1 y 65535' };
      }

      try {
        await target.setProxy({ mode: 'fixed_servers', proxyRules: `${scheme}://${host}:${port}` });
        // Solo recordamos como «activo» lo que afecta a la sesión compartida.
        if (config?.remember !== false) activeProxy = { scheme, host, port };
        const resolved = await target.resolveProxy('https://www.google.com/');
        return { ok: true, configured: { scheme, host, port }, resolved };
      } catch (error: any) {
        return { ok: false, reason: error?.message || String(error) };
      }
    },
  );

  ipcMain.handle('proxy:clear', async (_event, partition?: string) => {
    const target = sessionFor(partition);
    if (!target) return { ok: false, reason: 'Partición no válida' };
    try {
      await target.setProxy({ mode: 'direct' });
      const name = typeof partition === 'string' && partition ? partition : SHARED_PARTITION;
      if (name === SHARED_PARTITION) {
        activeProxy = null;
        proxyCredentials = null;
      }
      const resolved = await target.resolveProxy('https://www.google.com/');
      return { ok: true, configured: null, resolved };
    } catch (error: any) {
      return { ok: false, reason: error?.message || String(error) };
    }
  });

  ipcMain.handle('proxy:set-credentials', (_event, usuario: string, clave: string) => {
    if (typeof usuario === 'string' && usuario && typeof clave === 'string') {
      proxyCredentials = { usuario, clave };
      return { ok: true, hasCredentials: true };
    }
    proxyCredentials = null;
    return { ok: true, hasCredentials: false };
  });

  ipcMain.handle('proxy:test', async (_event, partition?: string, target?: string) => {    const targetSession = sessionFor(partition);
    if (!targetSession) return { ok: false, error: 'Partición no válida' };

    const url =
      typeof target === 'string' && /^https?:\/\//.test(target) ? target : 'https://www.google.com/generate_204';
    // Sonda anticaché: una respuesta servida desde la caché HTTP no pasa por el
    // proxy y hacía creer que la ruta funciona incluso con el servidor muerto
    // (falso 200). Verificado en QA: con caché 200 en 7 ms; con sonda, el error real.
    const probeUrl = `${url}${url.includes('?') ? '&' : '?'}nx_probe=${Date.now()}`;
    const started = Date.now();
    try {
      // `ses.fetch` sale por la red de esa sesión, así que respeta el proxy configurado.
      const response = await targetSession.fetch(probeUrl, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      });
      return {
        ok: response.ok || response.status === 204,
        status: response.status,
        latencyMs: Date.now() - started,
      };
    } catch (error: any) {
      return { ok: false, error: error?.message || String(error), latencyMs: Date.now() - started };
    }
  });

  /**
   * Instalación de PWAs: crea accesos directos reales (Escritorio y Menú Inicio)
   * que abren la app en una ventana propia con `--app=<url>`. Es lo que Chrome
   * llama «instalar aplicación»; Electron no lo trae de fábrica.
   */
  ipcMain.handle(
    'pwa:install',
    async (_event, datos?: { url?: string; name?: string; icon?: string | null; color?: string | null }) => {
      const url = typeof datos?.url === 'string' ? datos.url.trim() : '';
      const name = typeof datos?.name === 'string' ? datos.name.trim().slice(0, 60) : '';
      if (!/^https:\/\//i.test(url)) return { ok: false, reason: 'Solo se pueden instalar aplicaciones por HTTPS' };
      if (!name) return { ok: false, reason: 'La aplicación no declara nombre en su manifest' };
      // Los argumentos del acceso directo se escriben con comillas y sin espacios:
      // una URL con espacios o comillas permitiría inyectar opciones de Chromium.
      if (/[\s"'\\<>|]/.test(url)) {
        return { ok: false, reason: 'La dirección de la aplicación no es válida' };
      }

      const safeName = name.replace(/[\\/:*?"<>|]/g, '').trim() || 'Aplicacion';
      const opciones = {
        target: process.execPath,
        args: `--app="${url}"`,
        cwd: path.dirname(process.execPath),
        description: `${name} (instalada desde Navegador X)`,
        // MVP: el icono del acceso directo es el del propio navegador. Convertir
        // el PNG del manifest a .ico requeriría un paso extra de empaquetado.
        icon: process.execPath,
        iconIndex: 0,
      };

      const creados: string[] = [];
      try {
        const escritorio = path.join(app.getPath('desktop'), `${safeName}.lnk`);
        shell.writeShortcutLink(escritorio, 'create', opciones);
        creados.push(escritorio);
      } catch (error: any) {
        return { ok: false, reason: error?.message || String(error) };
      }
      try {
        const programas = path.join(
          app.getPath('appData'),
          'Microsoft',
          'Windows',
          'Start Menu',
          'Programs',
          `${safeName}.lnk`,
        );
        shell.writeShortcutLink(programas, 'create', opciones);
        creados.push(programas);
      } catch {
        // El acceso del Escritorio ya basta; el del Menú Inicio es opcional.
      }
      return { ok: true, name: safeName, shortcuts: creados };
    },
  );

  // Bloqueador de anuncios y rastreadores (nivel de red).
  ipcMain.handle('blocker:status', () => adBlocker.status());

  ipcMain.handle('blocker:set-enabled', (_event, enabled: boolean) => {
    adBlocker.setEnabled(Boolean(enabled));
    return adBlocker.status();
  });

  ipcMain.handle('blocker:clear-stats', () => {
    adBlocker.clearStats();
    return adBlocker.status();
  });

  ipcMain.handle('blocker:import', async () => {
    const win = BrowserWindow.getFocusedWindow() || mainWindow;
    const options: Electron.OpenDialogOptions = {
      title: 'Importar lista de bloqueo',
      properties: ['openFile'],
      filters: [
        { name: 'Listas de filtros', extensions: ['txt', 'list', 'hosts', 'conf'] },
        { name: 'Todos los ficheros', extensions: ['*'] },
      ],
    };

    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
    const filePath = result.filePaths?.[0];
    if (result.canceled || !filePath) return { ok: false, reason: 'cancelado' };

    try {
      const content = await fsp.readFile(filePath, 'utf-8');
      const applied = adBlocker.setCustomList(content, filePath);
      // Se guarda una copia para que la lista siga activa al reiniciar.
      await fsp.writeFile(path.join(app.getPath('userData'), CUSTOM_LIST_FILE), content, 'utf-8');
      return { ok: true, applied, ...adBlocker.status() };
    } catch (error: any) {
      return { ok: false, reason: error?.message || String(error) };
    }
  });

  ipcMain.handle('blocker:clear-custom', async () => {
    adBlocker.clearCustomList();
    await fsp.rm(path.join(app.getPath('userData'), CUSTOM_LIST_FILE), { force: true }).catch(() => {});
    return adBlocker.status();
  });
}

// ---------------------------------------------------------------------------
// Ciclo de vida
// ---------------------------------------------------------------------------

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    // Lanzar de nuevo un acceso directo de PWA abre otra ventana standalone,
    // no el navegador completo.
    const appArg = argv.find((arg) => arg.startsWith('--app='));
    if (appArg) {
      const url = appArg.slice('--app='.length).trim();
      if (/^https:\/\//i.test(url)) {
        createStandaloneAppWindow(url);
        return;
      }
    }
    const win = mainWindow;
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();

      const candidate = argv.find((arg) => /^https?:\/\//i.test(arg));
      if (candidate) {
        win.webContents.send('navegador:command', { command: 'open-tab', url: candidate });
      }
    }
  });

  /** URL de una PWA instalada pasada como `--app=<url>` (solo HTTPS). */
  const appUrlFromArgv = (): string | null => {
    const arg = process.argv.find((a) => a.startsWith('--app='));
    if (!arg) return null;
    const url = arg.slice('--app='.length).trim();
    return /^https:\/\//i.test(url) ? url : null;
  };

  /**
   * Ventana independiente de una PWA instalada: sin barra lateral ni pestañas,
   * comparte la sesión persistente del navegador (logins y cookies) y hereda el
   * bloqueador y el proxy de esa partición.
   */
  const createStandaloneAppWindow = (appUrl: string): void => {
    const win = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 480,
      minHeight: 360,
      backgroundColor: '#0b0f14',
      autoHideMenuBar: true,
      title: 'Aplicación web',
      webPreferences: {
        partition: BROWSER_PARTITION,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        spellcheck: true,
      },
    });
    win.webContents.on('page-title-updated', (_event, title) => {
      if (title) win.setTitle(title);
    });
    void win.loadURL(appUrl);
  };

  app.whenReady().then(() => {
    app.setAppUserModelId('app.navegadorx.desktop');
    migratePlaintextSecrets();

    if (!IS_DEV) {
      registerAppProtocol();
    }

    hardenSession(session.defaultSession);
    const browserSession = session.fromPartition(BROWSER_PARTITION);
    hardenSession(browserSession);

    attachDownloadHandler(session.defaultSession);
    attachDownloadHandler(browserSession);
    attachBlocker(browserSession, BROWSER_PARTITION);
    void loadCustomBlocklist();

    registerProxyAuthHandler();
    registerWebContentsHardening();
    registerIpcHandlers();
    buildMenu();

    mainWindow = createMainWindow();

    const standaloneUrl = appUrlFromArgv();
    if (standaloneUrl) createStandaloneAppWindow(standaloneUrl);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  // Enlaces profundos: navegadorx://... se reenvían a la SPA.
  app.on('open-url', (event, url) => {
    event.preventDefault();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('navegador:command', { command: 'open-url', url });
    }
  });
}
