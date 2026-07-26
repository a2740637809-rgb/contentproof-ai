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


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    content_type: str | None = None
    target_platform: str | None = None
    audience: str | None = None
    tone: str | None = None
    min_words: int | None = Field(default=None, ge=1)
    max_words: int | None = Field(default=None, ge=1)
    banned_phrases: list[str] | None = None
    status: str | None = None


class PromptCreate(BaseModel):
    name: str
    step: str
    template: str = Field(min_length=1)
    change_note: str = ""


class HumanReviewCreate(BaseModel):
    decision: str = Field(pattern="^(accepted|modified|rejected)$")
    reason_tags: list[str] = Field(default_factory=list)
    notes: str = ""
    final_text: str = ""


class EvaluationPayload(BaseModel):
    required_facts: list[str]
    text: str
    model_scores: dict[str, float]


class SourceCreate(BaseModel):
    title: str
    url: str
    excerpt: str = Field(max_length=180)
    facts: list[dict]


class SourceUpdate(BaseModel):
    title: str | None = None
    url: str | None = None
    excerpt: str | None = Field(default=None, max_length=180)
    facts: list[dict] | None = None
    status: str | None = Field(
        default=None, pattern="^(verified|pending|rejected)$"
    )


class RunCreate(BaseModel):
    prompt_version_id: int
    model_name: str
