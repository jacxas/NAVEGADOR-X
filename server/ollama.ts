/**
 * Ollama local inference provider for the web/server runtime.
 *
 * The endpoint is deliberately restricted to loopback. A hosted server must
 * not be tricked into sending prompts to arbitrary URLs supplied by a client.
 */
export type AiMode = 'local' | 'cloud' | 'hybrid';

export interface OllamaResult {
  response: string;
  provider: string;
  offline: boolean;
}

const REQUEST_TIMEOUT_MS = 60_000;

function ollamaBaseUrl(): string {
  const raw = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').trim();
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('OLLAMA_BASE_URL must be a valid URL.');
  }
  const loopback = url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '[::1]';
  if (!loopback || url.protocol !== 'http:' || url.username || url.password || url.search || url.hash) {
    throw new Error('Ollama endpoint must use HTTP on loopback without credentials, query or fragment.');
  }
  return url.toString().replace(/\/$/, '');
}

export function ollamaModel(): string {
  const model = (process.env.OLLAMA_MODEL || 'qwen2.5:7b').trim();
  if (!/^[a-zA-Z0-9._:-]{1,128}$/.test(model)) throw new Error('OLLAMA_MODEL is invalid.');
  return model;
}

export async function callOllama(
  prompt: string,
  options: { systemInstruction?: string; temperature?: number; fetchImpl?: typeof fetch } = {},
): Promise<OllamaResult> {
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 8_000) {
    throw new Error('Prompt is empty or exceeds the 8000-character limit.');
  }
  const baseUrl = ollamaBaseUrl();
  const model = ollamaModel();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await (options.fetchImpl || fetch)(`${baseUrl}/api/chat`, {
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
    if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}.`);
    const payload = await response.json() as { message?: { content?: unknown }; done?: unknown };
    const answer = payload?.message?.content;
    if (typeof answer !== 'string' || !answer.trim()) throw new Error('Ollama returned an empty response.');
    return { response: answer, provider: `Ollama (${model})`, offline: true };
  } finally {
    clearTimeout(timeout);
  }
}

export async function ollamaHealth(options: { fetchImpl?: typeof fetch } = {}): Promise<{
  available: boolean;
  model: string;
  models: string[];
}> {
  const baseUrl = ollamaBaseUrl();
  const model = ollamaModel();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await (options.fetchImpl || fetch)(`${baseUrl}/api/tags`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return { available: false, model, models: [] };
    const payload = await response.json() as { models?: Array<{ name?: unknown }> };
    const models = Array.isArray(payload.models)
      ? payload.models.map((item) => item?.name).filter((name): name is string => typeof name === 'string')
      : [];
    return { available: models.includes(model), model, models };
  } catch {
    return { available: false, model, models: [] };
  } finally {
    clearTimeout(timeout);
  }
}
