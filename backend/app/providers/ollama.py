import json
from time import perf_counter

import httpx

from app.providers.base import ModelRequest, ModelResult


class OllamaProvider:
    def __init__(
        self,
        base_url: str,
        model: str,
        transport: httpx.BaseTransport | None = None,
    ):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.client = httpx.Client(transport=transport, timeout=120)

    def list_models(self) -> list[str]:
        response = self.client.get(f"{self.base_url}/api/tags")
        response.raise_for_status()
        return [item["name"] for item in response.json().get("models", [])]

    def generate(self, request: ModelRequest) -> ModelResult:
        started = perf_counter()
        response = self.client.post(
            f"{self.base_url}/api/generate",
            json={
                "model": self.model,
                "prompt": request.prompt,
                "stream": False,
                "format": request.response_schema,
                "options": {"temperature": request.temperature},
            },
        )
        response.raise_for_status()
        text = response.json()["response"]
        return ModelResult(
            text=text,
            data=json.loads(text),
            model=self.model,
            elapsed_ms=round((perf_counter() - started) * 1000),
        )
