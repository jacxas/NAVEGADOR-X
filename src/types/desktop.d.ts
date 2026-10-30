/**
 * Tipos del puente nativo expuesto por el shell de escritorio.
 * En la edición web `window.navegadorX` es undefined y todo el código
 * debe degradar con elegancia al modo navegador.
 */

export interface NativeDownloadRecord {
  id: string;
  filename: string;
  url: string;
  savePath: string;
  totalBytes: number;
  receivedBytes: number;
  state: 'progressing' | 'paused' | 'completed' | 'cancelled' | 'interrupted';
  startedAt: number;
  endedAt?: number;
  speedBps: number;
  percent: number;
}

export interface NativeAppInfo {
  name: string;
  version: string;
  isPackaged: boolean;
  platform: string;
  arch: string;
  electron: string;
  chrome: string;
  node: string;
  downloadsPath: string;
  userDataPath: string;
  /** Metadatos de titularidad, leídos del paquete de la aplicación. */
  author: string | null;
  license: string | null;
  homepage: string | null;
  description: string | null;
  repository: string | null;
  appPath: string;
}

export interface NativeSystemMetrics {
  processes: Array<{ pid: number; type: string; cpuPercent: number; memoryMb: number }>;
  totalMemoryMb: number;
  totalCpuPercent: number;
  system: {
    freeMemoryMb: number;
    totalMemoryMb: number;
    cpuCount: number;
    uptimeSeconds: number;
    platform: string;
  };
  downloadsActive: number;
  sampledAt: number;
}

export interface NativeAiResult {
  response: string;
  provider: string;
  offline: boolean;
}

export interface NativeAiTranslation {
  success: boolean;
  translatedContent: string;
  provider: string;
  targetLanguage: string;
  url: string;
  offline: boolean;
}

export interface NavegadorXCommand {
  command: string;
  url?: string;
  [key: string]: unknown;
}

export interface NavegadorXBridge {
  isDesktop: true;
  platform: string;
  app: {
    getInfo: () => Promise<NativeAppInfo>;
    openExternal: (url: string) => Promise<boolean>;
    showItemInFolder: (target: string) => Promise<void>;
    openDownloadsFolder: () => Promise<void>;
    relaunch: () => Promise<void>;
  };
  window: {
    minimize: () => void;
    maximizeToggle: () => void;
    close: () => void;
    isMaximized: () => Promise<boolean>;
    onMaximizedChanged: (listener: (maximized: boolean) => void) => () => void;
    onFullscreenChanged: (listener: (fullscreen: boolean) => void) => () => void;
  };
  ai: {
    hasKey: () => Promise<boolean>;
    model: () => Promise<string>;
    mode: () => Promise<'local' | 'cloud' | 'hybrid'>;
    ollamaModel: () => Promise<string>;
    setOllamaModel: (model: string) => Promise<{ ok: boolean; model: string; reason?: string }>;
    setMode: (mode: 'local' | 'cloud' | 'hybrid') => Promise<{ ok: boolean; mode: 'local' | 'cloud' | 'hybrid'; reason?: string }>;
    setKey: (credencial: string, model?: string) => Promise<{ hasKey: boolean; model: string }>;
    query: (
      prompt: string,
      options?: { systemInstruction?: string; temperature?: number; mode?: 'local' | 'cloud' | 'hybrid' },
    ) => Promise<NativeAiResult>;
    translate: (url: string, targetLanguage: string, pageContent?: string) => Promise<NativeAiTranslation>;
  };
  downloads: {
    list: () => Promise<NativeDownloadRecord[]>;
    control: (
      id: string,
      action: 'pause' | 'resume' | 'cancel' | 'retry',
    ) => Promise<{ ok: boolean; reason?: string }>;
    openFile: (id: string) => Promise<{ ok: boolean; reason?: string }>;
    showInFolder: (id: string) => Promise<{ ok: boolean }>;
    clearFinished: () => Promise<NativeDownloadRecord[]>;
    start: (url: string) => void;
    onUpdate: (listener: (record: NativeDownloadRecord) => void) => () => void;
  };
  system: {
    metrics: () => Promise<NativeSystemMetrics>;
  };
  proxy: {
    ensure: (partition?: string) => Promise<{ ok: boolean; partition: string }>;
    status: (partition?: string) => Promise<NativeProxyStatus>;
    apply: (config: {
      partition?: string;
      scheme: string;
      host: string;
      port: number;
      remember?: boolean;
    }) => Promise<{
      ok: boolean;
      reason?: string;
      configured?: { scheme: string; host: string; port: number } | null;
      resolved?: string;
    }>;
    clear: (partition?: string) => Promise<{
      ok: boolean;
      reason?: string;
      configured?: null;
      resolved?: string;
    }>;
    setCredentials: (usuario: string, clave: string) => Promise<{ ok: boolean; hasCredentials: boolean }>;
    test: (partition?: string, target?: string) => Promise<NativeProxyTest>;
  };
  pwa: {
    install: (datos: PwaInstallRequest) => Promise<PwaInstallResult>;
  };
  blocker: {
    status: () => Promise<NativeBlockerStatus>;
    setEnabled: (enabled: boolean) => Promise<NativeBlockerStatus>;
    clearStats: () => Promise<NativeBlockerStatus>;
    importList: () => Promise<{ ok: boolean; reason?: string; applied?: number } & Partial<NativeBlockerStatus>>;
    clearCustom: () => Promise<NativeBlockerStatus>;
  };
  onCommand: (listener: (payload: NavegadorXCommand) => void) => () => void;
}

export interface NativeProxyStatus {
  configured: { scheme: string; host: string; port: number } | null;
  resolved: string;
  hasCredentials: boolean;
  error?: string;
}

export interface NativeProxyTest {
  ok: boolean;
  status?: number;
  latencyMs?: number;
  error?: string;
}

export interface NativeBlockerStatus {
  enabled: boolean;
  totalBlocked: number;
  since: number;
  topHosts: Array<{ host: string; count: number }>;
  rules: {
    builtin: number;
    custom: number;
    customSource: string | null;
    customLines: number;
  };
}

export interface PwaInstallRequest {
  url: string;
  name: string;
  icon?: string | null;
  color?: string | null;
}

export interface PwaInstallResult {
  ok: boolean;
  name?: string;
  shortcuts?: string[];
  reason?: string;
}

/**
 * Subconjunto tipado del elemento `<webview>` de Electron que consume la interfaz.
 * @see https://www.electronjs.org/docs/latest/api/webview-tag
 */
export interface ElectronWebviewElement extends HTMLElement {
  src: string;
  getURL(): string;
  getTitle(): string;
  loadURL(url: string): Promise<void>;
  reload(): void;
  reloadIgnoringCache(): void;
  stop(): void;
  canGoBack(): boolean;
  canGoForward(): boolean;
  goBack(): void;
  goForward(): void;
  isLoading(): boolean;
  isLoadingMainFrame(): boolean;
  isCurrentlyAudible(): boolean;
  openDevTools(): void;
  closeDevTools(): void;
  setZoomLevel(level: number): void;
  getZoomLevel(): number;
  setAudioMuted(muted: boolean): void;
  findInPage(text: string, options?: { forward?: boolean; findNext?: boolean }): number;
  stopFindInPage(action: 'clearSelection' | 'keepSelection' | 'activateSelection'): void;
  send(channel: string, ...args: unknown[]): void;
  insertCSS(css: string): Promise<string>;
  removeInsertedCSS(key: string): Promise<void>;
  executeJavaScript(code: string, userGesture?: boolean): Promise<unknown>;
  print(options?: Record<string, unknown>): Promise<void>;
}

declare global {
  interface Window {
    navegadorX?: NavegadorXBridge;
  }
}
