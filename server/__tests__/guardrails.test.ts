import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import {
  ALLOWED_TARGET_LANGUAGES,
  MAX_PAGE_CHARS,
  MAX_PROMPT_CHARS,
  createRateLimiter,
  isSafeId,
  readText,
  sanitizeRecord,
  validateAiQuery,
  validateTranslate,
} from '../guardrails';

describe('validateAiQuery', () => {
  it('acepta un prompt normal y recorta espacios', () => {
    const result = validateAiQuery({ prompt: '  hola  ' });
    expect(result.ok).toBe(true);
    if (result.ok) {\n      expect(result.value.prompt).toBe('hola');\n      expect(result.value.mode).toBe('local');\n    }
  });

  it('admite solo modos local, cloud o hybrid', () => {\n    expect(validateAiQuery({ prompt: 'x', mode: 'local' }).ok).toBe(true);\n    expect(validateAiQuery({ prompt: 'x', mode: 'cloud' }).ok).toBe(true);\n    expect(validateAiQuery({ prompt: 'x', mode: 'hybrid' }).ok).toBe(true);\n    expect(validateAiQuery({ prompt: 'x', mode: 'automatic' }).ok).toBe(false);\n  });\n\n  it('rechaza cuerpos que no son objetos', () => {
    for (const body of [null, undefined, 'texto', 42, ['a']]) {
      const result = validateAiQuery(body);
      expect(result.ok).toBe(false);
    }
  });

  it('rechaza prompt vacío, ausente o demasiado largo', () => {
    expect(validateAiQuery({}).ok).toBe(false);
    expect(validateAiQuery({ prompt: '   ' }).ok).toBe(false);
    expect(validateAiQuery({ prompt: 12 }).ok).toBe(false);
    expect(validateAiQuery({ prompt: 'a'.repeat(MAX_PROMPT_CHARS + 1) }).ok).toBe(false);
    expect(validateAiQuery({ prompt: 'a'.repeat(MAX_PROMPT_CHARS) }).ok).toBe(true);
  });

  it('acota también la instrucción de sistema', () => {
    expect(validateAiQuery({ prompt: 'x', systemInstruction: 'a'.repeat(2001) }).ok).toBe(false);
    const ok = validateAiQuery({ prompt: 'x', systemInstruction: '  sé breve  ' });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value.systemInstruction).toBe('sé breve');
  });
});

describe('validateTranslate', () => {
  it('acepta una petición válida y normaliza el idioma', () => {
    const result = validateTranslate({ url: 'https://example.com', targetLanguage: 'English' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.targetLanguage).toBe('English');
  });

  it('exige url', () => {
    expect(validateTranslate({ targetLanguage: 'Español' }).ok).toBe(false);
    expect(validateTranslate({ url: '', targetLanguage: 'Español' }).ok).toBe(false);
  });

  it('solo admite los idiomas del selector', () => {
    expect(ALLOWED_TARGET_LANGUAGES).toContain('Español');
    expect(validateTranslate({ url: 'https://a.test', targetLanguage: 'Klingon' }).ok).toBe(false);
    expect(validateTranslate({ url: 'https://a.test', targetLanguage: '' }).ok).toBe(false);
  });

  it('acota el contenido de la página', () => {
    const tooLong = { url: 'https://a.test', targetLanguage: 'Español', pageContent: 'a'.repeat(MAX_PAGE_CHARS + 1) };
    expect(validateTranslate(tooLong).ok).toBe(false);
  });
});

describe('isSafeId', () => {
  it('acepta identificadores simples', () => {
    expect(isSafeId('abc123')).toBe(true);
    expect(isSafeId('user_1-A')).toBe(true);
  });

  it('rechaza rutas, separadores y tipos raros', () => {
    for (const value of ['../etc/passwd', 'a/b', 'a b', '', 'a'.repeat(65), 7, null, {}]) {
      expect(isSafeId(value)).toBe(false);
    }
  });
});

describe('readText', () => {
  it('recorta y descarta lo que no es texto útil', () => {
    expect(readText('  hola  ', 10)).toBe('hola');
    expect(readText('', 10)).toBeNull();
    expect(readText('a'.repeat(11), 10)).toBeNull();
    expect(readText(5, 10)).toBeNull();
  });
});

describe('sanitizeRecord', () => {
  it('copia solo valores serializables', () => {
    const cleaned = sanitizeRecord({
      title: 'pestaña',
      count: 3,
      active: true,
      nothing: null,
      fn: () => 'nope',
      when: new Date(),
      infinity: Infinity,
    });

    expect(cleaned).toEqual({ title: 'pestaña', count: 3, active: true, nothing: null });
  });

  it('descarta claves peligrosas y recorta cadenas', () => {
    const cleaned = sanitizeRecord({
      __proto__: { polluted: true },
      constructor: 'x',
      prototype: 'y',
      note: 'a'.repeat(5_000),
    }) as Record<string, unknown>;

    expect(cleaned).not.toHaveProperty('constructor');
    expect(cleaned).not.toHaveProperty('prototype');
    expect((cleaned.note as string).length).toBe(2_000);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('limita la profundidad y el número de claves', () => {
    const deep = { a: { b: { c: { d: { e: { f: 'muy profundo' } } } } } };
    const cleaned = sanitizeRecord(deep, { maxDepth: 2 }) as any;
    expect(cleaned.a.b.c).toBeUndefined();

    const many = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`k${i}`, i]));
    expect(Object.keys(sanitizeRecord(many) as object)).toHaveLength(40);
  });

  it('devuelve null si no es un objeto', () => {
    for (const value of [null, 'x', 3, ['a']]) expect(sanitizeRecord(value)).toBeNull();
  });
});

describe('createRateLimiter', () => {
  const makeReq = (ip: string) => ({ ip, socket: { remoteAddress: ip } }) as unknown as Request;
  const makeRes = () => {
    const res = {
      statusCode: 0,
      headers: {} as Record<string, string>,
      body: null as unknown,
      setHeader(name: string, value: string) {
        this.headers[name] = value;
      },
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: unknown) {
        this.body = payload;
        return this;
      },
    };
    return res;
  };

  it('permite hasta el máximo y luego responde 429', () => {
    const limiter = createRateLimiter({ windowMs: 1_000, max: 2 });
    const next = vi.fn();

    const first = makeRes();
    limiter(makeReq('1.1.1.1'), first as unknown as Response, next as unknown as NextFunction);
    expect(next).toHaveBeenCalledTimes(1);
    expect(first.statusCode).toBe(0);

    limiter(makeReq('1.1.1.1'), makeRes() as unknown as Response, next as unknown as NextFunction);
    expect(next).toHaveBeenCalledTimes(2);

    const blocked = makeRes();
    limiter(makeReq('1.1.1.1'), blocked as unknown as Response, next as unknown as NextFunction);
    expect(next).toHaveBeenCalledTimes(2);
    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers['Retry-After']).toBeDefined();
  });

  it('cuenta por origen, no de forma global', () => {
    const limiter = createRateLimiter({ windowMs: 1_000, max: 1 });
    const next = vi.fn();

    limiter(makeReq('1.1.1.1'), makeRes() as unknown as Response, next as unknown as NextFunction);
    limiter(makeReq('2.2.2.2'), makeRes() as unknown as Response, next as unknown as NextFunction);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('reinicia al caducar la ventana', () => {
    vi.useFakeTimers();
    try {
      const limiter = createRateLimiter({ windowMs: 1_000, max: 1 });
      const next = vi.fn();

      limiter(makeReq('3.3.3.3'), makeRes() as unknown as Response, next as unknown as NextFunction);
      limiter(makeReq('3.3.3.3'), makeRes() as unknown as Response, next as unknown as NextFunction);
      expect(next).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1_001);
      limiter(makeReq('3.3.3.3'), makeRes() as unknown as Response, next as unknown as NextFunction);
      expect(next).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rechaza una configuración inválida', () => {
    expect(() => createRateLimiter({ windowMs: 0, max: 1 })).toThrow();
    expect(() => createRateLimiter({ windowMs: 1_000, max: 0 })).toThrow();
  });
});
