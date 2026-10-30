import { afterEach, describe, expect, it, vi } from 'vitest';
import { callOllama, ollamaHealth } from './ollama';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Ollama provider', () => {
  it('sends chat requests to the configured local model', async () => {
    vi.stubEnv('OLLAMA_MODEL', 'qwen2.5:7b');
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.model).toBe('qwen2.5:7b');
      expect(body.stream).toBe(false);
      expect(body.messages.at(-1)).toEqual({ role: 'user', content: 'Hola' });
      return {
        ok: true,
        json: async () => ({ message: { content: 'Respuesta local' } }),
      } as Response;
    }) as unknown as typeof fetch;

    await expect(callOllama('Hola', { fetchImpl })).resolves.toMatchObject({
      response: 'Respuesta local',
      provider: 'Ollama (qwen2.5:7b)',
      offline: true,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('rejects non-loopback endpoints to prevent server-side request forgery', async () => {
    vi.stubEnv('OLLAMA_BASE_URL', 'http://169.254.169.254');
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    await expect(callOllama('Hola', { fetchImpl })).rejects.toThrow(/loopback/i);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('reports health only when the configured model is installed', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ models: [{ name: 'qwen2.5:7b' }] }),
    }) as Response) as unknown as typeof fetch;
    await expect(ollamaHealth({ fetchImpl })).resolves.toMatchObject({
      available: true,
      model: 'qwen2.5:7b',
    });
  });

  it('rejects empty and oversized prompts before network access', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    await expect(callOllama('   ', { fetchImpl })).rejects.toThrow(/empty/i);
    await expect(callOllama('x'.repeat(8001), { fetchImpl })).rejects.toThrow(/8000/i);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
