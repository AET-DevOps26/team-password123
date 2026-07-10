# Vision models: Gemini vs Nemotron

Calorieasy uses two OpenAI-compatible vision backends for meal photo scan:

| | **Gemini** (primary) | **Nemotron** (backup) |
|---|----------------------|------------------------|
| **Provider** | Google AI Studio / Generative Language API | OpenRouter (free tier) |
| **Model (recommended backup)** | `gemini-3.1-flash-lite` | `nvidia/nemotron-nano-12b-v2-vl:free` |
| **Alternate backup** | — | `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` (slower; reasoning disabled in code) |
| **Role** | Default in prod (`auto` mode) | Used when Gemini fails, or when forced via picker |
| **Typical latency** | **1–2 seconds** | **~6–10 seconds** when OpenRouter free pool is healthy; **up to 90s timeout** when congested |
| **Typical confidence** | **~90%** on clear food photos | **~85–90%** when JSON parses cleanly |
| **Quota** | Google project free tier | OpenRouter free-model daily cap; shared upstream providers hit **429** under load |
| **Best for** | Production default, fast UX | Fallback when Gemini is rate-limited or down |

## Behaviour in the app

- **`auto`** (default when picker is hidden): try Gemini → on error, try Nemotron.
- **`gemini`**: Gemini only; no silent fallback (fails if Gemini errors).
- **`nemotron`**: OpenRouter backup only (`BACKUP_OPENAI_MODEL`); fails if unset, rate-limited, or timed out.

After analysis, the scan overlay shows which model ran, e.g. `90% match · Nemotron`.

## Backup implementation notes

- genai-service calls OpenRouter **directly** (not via LangChain) with `reasoning: off` and a short JSON prompt.
- Images are downscaled (`BACKUP_VISION_MAX_SIDE`, default 384px) before upload.
- Hard timeout: `BACKUP_VISION_TIMEOUT_SEC` (default **90s**). Free Nemotron often fails with timeout when OpenRouter is busy — retry later or use a paid OpenRouter route for reliability.

## Local testing (Jul 2026)

| Model | When healthy | When OpenRouter congested |
|-------|----------------|---------------------------|
| Nemotron 12B VL | ~6s, pizza detected | 90s timeout |
| Nemotron 30B omni | ~8s | 90s timeout or 524 gateway timeout |
| Gemma 4 26B `:free` | — | Instant **429** (upstream rate limit) |

## Configuration

Root `.env` / `services/genai-service/.env.example` / Helm `genai.*`:

- Primary: `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`
- Backup: `BACKUP_OPENAI_API_KEY`, `BACKUP_OPENAI_BASE_URL`, `BACKUP_OPENAI_MODEL`
- Optional tuning: `BACKUP_OPENAI_MAX_TOKENS`, `BACKUP_VISION_TIMEOUT_SEC`, `BACKUP_VISION_MAX_SIDE`

Smoke test (direct genai, no auth):

```bash
curl -X POST "http://localhost:8084/api/analyze?vision_provider=nemotron" \
  -F "file=@test-images/pizza-slice.jpg"
```

## Related

- [Feature toggles](./feature-toggles.md) — enable the scan UI model picker locally or in prod
- `services/genai-service/tests/test_vision_fallback.py` — unit tests for fallback logic
- `services/genai-service/scripts/test_openrouter_nemotron.py` — optional OpenRouter timing script
