from typing import Protocol

from pydantic import BaseModel, ConfigDict, Field


class ModelRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    prompt: str
    response_schema: dict = Field(alias="schema")
    temperature: float = 0.2


class ModelResult(BaseModel):
    text: str
    data: dict
    model: str
    elapsed_ms: int


class ModelProvider(Protocol):
    def generate(self, request: ModelRequest) -> ModelResult: ...
