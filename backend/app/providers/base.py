from typing import Protocol

from pydantic import BaseModel


class ModelRequest(BaseModel):
    prompt: str
    schema: dict
    temperature: float = 0.2


class ModelResult(BaseModel):
    text: str
    data: dict
    model: str
    elapsed_ms: int


class ModelProvider(Protocol):
    def generate(self, request: ModelRequest) -> ModelResult: ...
