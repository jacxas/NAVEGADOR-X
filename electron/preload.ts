/**
 * Navegador X — Preload del shell de escritorio
 * =============================================
 * Único puente entre el renderer (SPA) y el proceso principal.
 *
 * Reglas:
 *  - contextIsolation activo: el renderer nunca toca `ipcRenderer` directamente.
 *  - Solo se exponen operaciones explícitas y tipadas en `window.navegadorX`.
 *  - Ninguna credencial viaja al renderer: la clave de Gemini vive en el proceso
 *    principal y aquí solo se ofrece `ai.hasKey()`.
 */

import { contextBridge, ipcRenderer } from 'electron';

type Unsubscribe = () => void;

function subscribe<T>(channel: string, listener: (payload: T) => void): Unsubscribe {
  const handler = (_event: Electron.IpcRendererEvent, payload: T) => listener(payload);
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
}

const bridge = {
  isDesktop: true as const,
  platform: process.platform,

  app: {
    getInfo: () => ipcRenderer.invoke('app:get-info'),
    openExternal: (url: string) => ipcRenderer.invoke('app:open-external', url),
    showItemInFolder: (target: string) => ipcRenderer.invoke('app:show-item-in-folder', target),
    openDownloadsFolder: () => ipcRenderer.invoke('app:open-downloads-folder'),
    relaunch: () => ipcRenderer.invoke('app:relaunch'),
  },

  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximizeToggle: () => ipcRenderer.send('window:maximize-toggle'),
    close: () => ipcRenderer.send('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
    onMaximizedChanged: (listener: (maximized: boolean) => void) =>
      subscribe<boolean>('window:maximized-changed', listener),
    onFullscreenChanged: (listener: (fullscreen: boolean) => void) =>
      subscribe<boolean>('window:fullscreen-changed', listener),
  },

  ai: {
    hasKey: () => ipcRenderer.invoke('ai:has-key'),
    model: () => ipcRenderer.invoke('ai:model'),
    mode: () => ipcRenderer.invoke('ai:mode'),
    ollamaModel: () => ipcRenderer.invoke('ai:ollama-model'),
    setOllamaModel: (model: string) => ipcRenderer.invoke('ai:set-ollama-model', model),
    setMode: (mode: 'local' | 'cloud' | 'hybrid') => ipcRenderer.invoke('ai:set-mode', mode),
    setKey: (credencial: string, model?: string) => ipcRenderer.invoke('ai:set-key', credencial, model),
    query: (prompt: string, options?: { systemInstruction?: string; temperature?: number; mode?: 'local' | 'cloud' | 'hybrid' }) =>
      ipcRenderer.invoke('ai:query', prompt, options),
    translate: (url: string, targetLanguage: string, pageContent?: string) =>
      ipcRenderer.invoke('ai:translate', url, targetLanguage, pageContent),
  },

  downloads: {
    list: () => ipcRenderer.invoke('downloads:list'),
    control: (id: string, action: 'pause' | 'resume' | 'cancel' | 'retry') =>
      ipcRenderer.invoke('downloads:control', id, action),
    openFile: (id: string) => ipcRenderer.invoke('downloads:open-file', id),
    showInFolder: (id: string) => ipcRenderer.invoke('downloads:show-in-folder', id),
    clearFinished: () => ipcRenderer.invoke('downloads:clear-finished'),
    start: (url: string) => ipcRenderer.send('downloads:start', url),
    onUpdate: (listener: (record: unknown) => void) => subscribe('download:update', listener),
  },

  system: {
    metrics: () => ipcRenderer.invoke('system:metrics'),
  },

  /** Red: configuración de proxy real, por sesión compartida o por pestaña. */
  proxy: {
    ensure: (partition?: string) => ipcRenderer.invoke('proxy:ensure', partition),
    status: (partition?: string) => ipcRenderer.invoke('proxy:status', partition),
    apply: (config: { partition?: string; scheme: string; host: string; port: number; remember?: boolean }) =>
      ipcRenderer.invoke('proxy:apply', config),
    clear: (partition?: string) => ipcRenderer.invoke('proxy:clear', partition),
    setCredentials: (usuario: string, clave: string) =>
      ipcRenderer.invoke('proxy:set-credentials', usuario, clave),
    test: (partition?: string, target?: string) => ipcRenderer.invoke('proxy:test', partition, target),
  },

  /** Instalación de PWAs: accesos directos + ventana propia. */
  pwa: {
    install: (datos: { url: string; name: string; icon?: string | null; color?: string | null }) =>
      ipcRenderer.invoke('pwa:install', datos),
  },

  /** Bloqueador de anuncios y rastreadores, a nivel de red. */
  blocker: {
    status: () => ipcRenderer.invoke('blocker:status'),
    setEnabled: (enabled: boolean) => ipcRenderer.invoke('blocker:set-enabled', enabled),
    clearStats: () => ipcRenderer.invoke('blocker:clear-stats'),
    importList: () => ipcRenderer.invoke('blocker:import'),
    clearCustom: () => ipcRenderer.invoke('blocker:clear-custom'),
  },

  onCommand: (
    listener: (payload: { command: string; url?: string; [key: string]: unknown }) => void,
  ) => subscribe('navegador:command', listener),
};

export type NavegadorXBridge = typeof bridge;

contextBridge.exposeInMainWorld('navegadorX', bridge);
