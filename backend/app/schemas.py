from pydantic import BaseModel, Field, model_validator


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content_type: str
    target_platform: str
    audience: str
    tone: str
    min_words: int = Field(ge=1)
    max_words: int = Field(ge=1)
    banned_phrases: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_word_range(self) -> "TaskCreate":
        if self.max_words < self.min_words:
            raise ValueError("max_words must be greater than or equal to min_words")
        return self


class PromptCreate(BaseModel):
    name: str
    step: str
    template: str = Field(min_length=1)
    change_note: str = ""
