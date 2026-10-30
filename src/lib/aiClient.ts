/**
 * Cliente de IA unificado.
 *
 * - Escritorio: las llamadas viajan por IPC al proceso principal, que es el único
 *   que conoce la clave de Gemini. El renderer nunca ve credenciales.
 * - Web: se usan los endpoints `/api/v1/ai/*` del servidor Express, que aplican
 *   exactamente la misma política (clave en servidor y fallback local sin clave).
 *
 * Ollama local es la ruta predeterminada. Si no está disponible, la consulta falla
 * sin enviar datos a la nube. Cloud e híbrido requieren selección explícita.
 */

import { desktopBridge, isDesktopApp } from '@/src/lib/desktop';

export interface AiQueryResult {
  response: string;
  provider: string;
  offline: boolean;
}

export interface AiTranslationResult {
  success: boolean;
  translatedContent: string;
  provider: string;
  targetLanguage: string;
  url: string;
  offline: boolean;
}

export async function aiQuery(
  prompt: string,
  options?: { systemInstruction?: string; temperature?: number; mode?: 'local' | 'cloud' | 'hybrid' },
): Promise<AiQueryResult> {
  const bridge = desktopBridge();
  if (bridge) {
    return bridge.ai.query(prompt, options);
  }

  const response = await fetch('/api/v1/ai/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, systemInstruction: options?.systemInstruction, mode: options?.mode || 'local' }),
  });

  const data = await response.json().catch(() => ({} as Record<string, unknown>));
  if (!response.ok) {
    const message = typeof data.error === 'string' ? data.error : `El servidor de IA respondió ${response.status}`;
    throw new Error(message);
  }
  const provider: string = data.provider || 'Desconocido';
  return {
    response: data.response || '',
    provider,
    offline: /offline|sin api key/i.test(provider) || /\[Modo Offline/i.test(data.response || ''),
  };
}

export async function aiTranslate(
  url: string,
  targetLanguage: string,
  pageContent?: string,
  mode?: 'local' | 'cloud' | 'hybrid',
): Promise<AiTranslationResult> {
  const bridge = desktopBridge();
  if (bridge) {
    return bridge.ai.translate(url, targetLanguage, pageContent, mode);
  }

  const response = await fetch('/api/v1/ai/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, targetLanguage, pageContent, mode }),
  });

  const data = await response.json().catch(() => ({} as Record<string, unknown>));

  if (!response.ok) {
    // El servidor explica el motivo (por ejemplo, que falta la clave de IA).
    const message =
      typeof data?.error === 'string' ? data.error : `El servicio de traducción respondió ${response.status}`;
    throw new Error(message);
  }

  const provider: string = data.provider || '';
  return {
    success: data.success !== false,
    translatedContent: data.translatedContent || '',
    provider,
    targetLanguage: data.targetLanguage || targetLanguage,
    url: data.url || url,
    offline: data.offline === true || /fallback|offline/i.test(provider),
  };
}

/** ¿Hay una clave de Gemini utilizable en este entorno? */
export async function aiHasKey(): Promise<boolean> {
  const bridge = desktopBridge();
  if (bridge) return bridge.ai.hasKey();
  // En web la clave vive en el servidor: si el endpoint responde sin proveedor
  // real, el propio servidor devolverá el motor local.
  try {
    const response = await fetch('/api/v1/ai/local-status', { method: 'GET' });
    if (!response.ok) return false;
    const data = await response.json();
    return data.geminiConfigured === true;
  } catch {
    return false;
  }
}

/** Guarda la clave de Gemini (solo disponible en la edición de escritorio). */
export async function aiSetKey(
  credencial: string,
  model?: string,
): Promise<{ hasKey: boolean; model: string } | null> {
  const bridge = desktopBridge();
  if (!bridge) return null;
  return bridge.ai.setKey(credencial, model);
}

export { isDesktopApp };
