/**
 * Guardarraíles del servidor web.
 *
 * Todo lo que hay aquí es lógica pura (sin Express de verdad): validación de
 * cuerpos, saneado de objetos y un limitador de peticiones en memoria. Se puede
 * probar sin levantar el servidor ni abrir un puerto.
 */

import type { NextFunction, Request, Response } from 'express';

// ---------------------------------------------------------------------------
// Límites de entrada
// ---------------------------------------------------------------------------

export const MAX_PROMPT_CHARS = 8_000;
export const MAX_SYSTEM_CHARS = 2_000;
export const MAX_URL_CHARS = 2_048;
export const MAX_PAGE_CHARS = 20_000;
export const MAX_ID_CHARS = 64;

/** Idiomas que la interfaz ofrece en el selector de traducción. */
export const ALLOWED_TARGET_LANGUAGES = [
  'Español',
  'English',
  'Français',
  'Deutsch',
  'Português',
  'Italiano',
  '日本語',
] as const;

export type TargetLanguage = (typeof ALLOWED_TARGET_LANGUAGES)[number];

// ---------------------------------------------------------------------------
// Resultado de validación
// ---------------------------------------------------------------------------

export interface ValidationOk<T> {
  ok: true;
  value: T;
}

export interface ValidationError {
  ok: false;
  error: string;
}

export type ValidationResult<T> = ValidationOk<T> | ValidationError;

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/** Objeto JSON plano (ni array, ni null, ni primitivo). */
export function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** Texto no vacío y de longitud acotada, ya recortado; `null` si no vale. */
export function readText(value: unknown, maxChars: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxChars) return null;
  return trimmed;
}

/** Identificador seguro para rutas (`/sessions/:id`). */
export function isSafeId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value);
}

// ---------------------------------------------------------------------------
// Validación de los cuerpos de la API
// ---------------------------------------------------------------------------

export interface AiQueryInput {
  prompt: string;
  systemInstruction?: string;
}

export function validateAiQuery(body: unknown): ValidationResult<AiQueryInput> {
  const input = asRecord(body);
  if (!input) return { ok: false, error: 'El cuerpo debe ser un objeto JSON.' };

  const prompt = readText(input.prompt, MAX_PROMPT_CHARS);
  if (!prompt) {
    return { ok: false, error: `«prompt» es obligatorio y no puede superar ${MAX_PROMPT_CHARS} caracteres.` };
  }

  let systemInstruction: string | undefined;
  if (input.systemInstruction !== undefined && input.systemInstruction !== null) {
    const parsed = readText(input.systemInstruction, MAX_SYSTEM_CHARS);
    if (!parsed) {
      return { ok: false, error: `«systemInstruction» no puede superar ${MAX_SYSTEM_CHARS} caracteres.` };
    }
    systemInstruction = parsed;
  }

  const mode = input.mode === undefined ? 'local' : input.mode;\n  if (mode !== 'local' && mode !== 'cloud' && mode !== 'hybrid') {\n    return { ok: false, error: '«mode» debe ser local, cloud o hybrid.' };\n  }\n\n  return { ok: true, value: { prompt, systemInstruction, mode } };
}

export interface TranslateInput {
  url: string;
  targetLanguage: TargetLanguage;
  pageContent?: string;
  mode: 'local' | 'cloud' | 'hybrid';
}

export function validateTranslate(body: unknown): ValidationResult<TranslateInput> {
  const input = asRecord(body);
  if (!input) return { ok: false, error: 'El cuerpo debe ser un objeto JSON.' };

  const url = readText(input.url, MAX_URL_CHARS);
  if (!url) {
    return { ok: false, error: `«url» es obligatoria y no puede superar ${MAX_URL_CHARS} caracteres.` };
  }

  const targetLanguage = typeof input.targetLanguage === 'string' ? input.targetLanguage.trim() : '';
  if (!ALLOWED_TARGET_LANGUAGES.includes(targetLanguage as TargetLanguage)) {
    return { ok: false, error: 'Idioma de destino no admitido.' };
  }

  let pageContent: string | undefined;
  if (input.pageContent !== undefined && input.pageContent !== null) {
    const parsed = readText(input.pageContent, MAX_PAGE_CHARS);
    if (!parsed) {
      return { ok: false, error: `«pageContent» no puede superar ${MAX_PAGE_CHARS} caracteres.` };
    }
    pageContent = parsed;
  }

  const mode = input.mode === undefined ? 'local' : input.mode;
  if (mode !== 'local' && mode !== 'cloud' && mode !== 'hybrid') {
    return { ok: false, error: '«mode» debe ser local, cloud o hybrid.' };
  }

  return { ok: true, value: { url, targetLanguage: targetLanguage as TargetLanguage, pageContent, mode } };
}

// ---------------------------------------------------------------------------
// Saneado de objetos que se guardan en disco (db.ts)
// ---------------------------------------------------------------------------

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Copia un objeto JSON descartando claves peligrosas, valores no serializables y
 * profundidad excesiva. Devuelve `null` si el valor no es un objeto utilizable.
 */
export function sanitizeRecord(
  value: unknown,
  { maxDepth = 4, maxStringChars = 2_000, maxKeys = 40 }: { maxDepth?: number; maxStringChars?: number; maxKeys?: number } = {},
): Record<string, unknown> | null {
  const source = asRecord(value);
  if (!source) return null;

  const walk = (input: Record<string, unknown>, depth: number): Record<string, unknown> => {
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(input).slice(0, maxKeys)) {
      if (FORBIDDEN_KEYS.has(key) || key.length > MAX_ID_CHARS) continue;

      const entry = input[key];
      if (entry === null || typeof entry === 'boolean' || typeof entry === 'number') {
        if (typeof entry === 'number' && !Number.isFinite(entry)) continue;
        output[key] = entry;
        continue;
      }
      if (typeof entry === 'string') {
        output[key] = entry.slice(0, maxStringChars);
        continue;
      }
      if (Array.isArray(entry)) {
        if (depth >= maxDepth) continue;
        output[key] = entry
          .filter((item) => item === null || ['string', 'number', 'boolean'].includes(typeof item))
          .slice(0, maxKeys);
        continue;
      }
      if (typeof entry === 'object' && depth < maxDepth) {
        // Solo objetos planos: un Date, un Map o una instancia de clase se
        // serializarían como `{}` o con propiedades internas.
        const prototype = Object.getPrototypeOf(entry);
        if (prototype === Object.prototype || prototype === null) {
          const nested = asRecord(entry);
          if (nested) output[key] = walk(nested, depth + 1);
        }
      }
    }
    return output;
  };

  return walk(source, 0);
}

// ---------------------------------------------------------------------------
// Limitador de peticiones en memoria
// ---------------------------------------------------------------------------

export interface RateLimitOptions {
  /** Tamaño de la ventana en milisegundos. */
  windowMs: number;
  /** Peticiones permitidas por origen y ventana. */
  max: number;
}

export interface RateLimiter {
  (req: Request, res: Response, next: NextFunction): void;
  /** Vacía los contadores (pruebas y reinicios). */
  reset: () => void;
}

/**
 * Ventana fija por dirección de origen. Es deliberadamente simple: una sola
 * instancia del servidor en local, sin dependencias externas ni estado compartido.
 */
export function createRateLimiter({ windowMs, max }: RateLimitOptions): RateLimiter {
  if (!Number.isFinite(windowMs) || windowMs <= 0) throw new Error('windowMs debe ser un número positivo');
  if (!Number.isFinite(max) || max <= 0) throw new Error('max debe ser un número positivo');

  const buckets = new Map<string, { count: number; resetAt: number }>();

  const prune = (now: number) => {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  };

  const limiter = ((req: Request, res: Response, next: NextFunction) => {
    // `req.ip` depende de la conexión real: no se confía en X-Forwarded-For.
    const key = req.ip || req.socket?.remoteAddress || 'desconocido';
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      if (buckets.size > 1_000) prune(now);
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (bucket.count >= max) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000))));
      res.status(429).json({
        error: 'Demasiadas peticiones. Espera un momento antes de volver a intentarlo.',
        code: 'rate_limited',
      });
      return;
    }

    bucket.count += 1;
    next();
  }) as RateLimiter;

  limiter.reset = () => buckets.clear();
  return limiter;
}
