# Hybrid AI integration

## Runtime behavior

Navegador X supports three explicit routing modes:

| Mode | Behavior | Cloud transmission |
|---|---|---|
| `local` | Calls Ollama on loopback. If unavailable, returns an error. | Never |
| `cloud` | Calls Gemini. | Always, by explicit selection |
| `hybrid` | Tries Ollama first; calls Gemini only if local inference fails. | Only after explicit hybrid selection |

The default is `local`. A missing API key or unavailable local model no longer produces
a fabricated answer or silently switches to Gemini.

## Desktop

- Ollama endpoint is fixed to `http://127.0.0.1:11434`.
- Default model: `qwen2.5:7b`.
- The AI settings panel stores the routing mode and local model in the Electron
  user settings file.
- Gemini credentials continue to be stored by Electron `safeStorage`; the
  renderer does not receive the key.
- Select `Híbrido` only if you consent to sending a prompt to Gemini when Ollama
  is unavailable.

Install Ollama separately and download the configured model before selecting
local inference. For example:

```powershell
ollama pull qwen2.5:7b
ollama serve
```

## Local Express / web runtime

The Express server calls Ollama at `OLLAMA_BASE_URL`, defaulting to
`http://127.0.0.1:11434`. Only loopback HTTP endpoints are accepted to prevent
a remote request from turning the server into an SSRF proxy.

Optional environment variables:

```env
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:7b
GEMINI_API_KEY=
```

The web settings panel persists the selected mode in browser storage and sends
it explicitly with each request. The default is `local`; cloud and hybrid are
never selected implicitly. A hosted web server can only reach
Ollama installed on that server; it cannot reach the visitor's desktop Ollama
through the browser.

## API

- `POST /api/v1/ai/query` accepts `prompt`, optional `systemInstruction`,
  and `mode: local | cloud | hybrid`.
- `POST /api/v1/ai/translate` accepts the same `mode` and requires actual
  `pageContent`. A URL alone is not page content and is not summarized or
  translated as if it had been read.
- `GET /api/v1/ai/local-status` reports whether the configured Ollama model is
  present and whether Gemini is configured. It never returns credentials.

## Validation boundary

The provider has unit tests for request construction, model selection, invalid
remote endpoints, prompt limits and health reporting. End-to-end inference still
requires a running Ollama service and the selected model on the target machine.
