import httpx

from app.providers.base import ModelRequest
from app.providers.ollama import OllamaProvider


def test_ollama_provider_parses_structured_result():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"response": '{"text":"成稿"}', "done": True})

    provider = OllamaProvider(
        base_url="http://ollama.test",
        model="qwen2:1.5b",
        transport=httpx.MockTransport(handler),
    )

    result = provider.generate(ModelRequest(prompt="写稿", schema={"type": "object"}))

    assert result.data == {"text": "成稿"}
    assert result.model == "qwen2:1.5b"
