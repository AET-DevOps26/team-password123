"""Canned OpenAI-compatible stub for the CI e2e-smoke job.

Serves POST /v1/chat/completions with a fixed chat completion whose content is
the nutrition JSON genai-service's parser expects, so the REAL genai-service
runs in CI with zero cloud keys and fully deterministic output. stdlib only —
keeps the image tiny and dependency-free.
"""
import json
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = 9990

# genai's vision prompt (nutrition_analyzer._build_prompt) asks for exactly
# {"foods":[{"food","grams"}],"confidence"} — macros are computed genai-side
# from its local nutrition DB, NOT returned by the LLM.
VISION_CONTENT = json.dumps(
    {"foods": [{"food": "grilled chicken bowl", "grams": 350}], "confidence": 0.9}
)

# genai's text-estimate prompt (estimate_from_name) asks for per-100g values.
ESTIMATE_CONTENT = json.dumps({
    "calories_per_100g": 165, "protein_grams_per_100g": 31,
    "carbs_grams_per_100g": 0, "fat_grams_per_100g": 3.6,
    "typical_portion_grams": 350, "typical_portion_label": "1 bowl",
    "confidence": 0.9,
})


def _content_for(body: bytes) -> str:
    """The vision request carries an image_url content part; the text-estimate
    request is plain text mentioning 'per 100g' (as does the vision prompt —
    'not per 100g' — so the image part is the only reliable discriminator).
    Default to the vision answer."""
    try:
        messages = json.dumps(json.loads(body).get("messages", []))
    except (ValueError, AttributeError):
        return VISION_CONTENT
    if "image_url" in messages:
        return VISION_CONTENT
    return ESTIMATE_CONTENT if "per 100g" in messages else VISION_CONTENT


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def do_POST(self):
        if self.path.rstrip("/") != "/v1/chat/completions":
            self._send(404, {"error": {"message": f"unknown path {self.path}"}})
            return
        body = self.rfile.read(int(self.headers.get("content-length") or 0))
        self._send(200, {
            "id": "chatcmpl-ci-stub",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": "ci-stub-vision",
            "choices": [{
                "index": 0,
                "message": {"role": "assistant", "content": _content_for(body)},
                "finish_reason": "stop",
            }],
            "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
        })

    def do_GET(self):  # container/readiness probes
        self._send(200, {"status": "ok", "service": "fake-openai"})

    def _send(self, code: int, payload: dict) -> None:
        data = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


if __name__ == "__main__":
    print(f"fake-openai stub listening on :{PORT}", flush=True)
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
