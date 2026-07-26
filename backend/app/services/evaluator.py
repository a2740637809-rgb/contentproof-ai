from pydantic import BaseModel, Field, model_validator

from app.services.rules import RuleResult


class DimensionResult(BaseModel):
    score: float = Field(ge=0, le=100)
    reason: str = Field(min_length=1)
    evidence: list[str] = Field(default_factory=list)


class EvaluationResult(BaseModel):
    dimensions: dict[str, DimensionResult]
    total: float = Field(ge=0, le=100)
    advisory: bool = True
    rule_passed: bool
    rule_evidence: dict
    label: str = "模型辅助评分，仅供参考"

    @property
    def scores(self) -> dict[str, float]:
        return {name: result.score for name, result in self.dimensions.items()}

    @model_validator(mode="after")
    def validate_dimensions(self) -> "EvaluationResult":
        if set(self.dimensions) != set(EvaluationService.weights):
            raise ValueError("model score dimensions do not match the rubric")
        return self


class EvaluationService:
    weights = {
        "factual_accuracy": 0.35,
        "structure": 0.20,
        "readability": 0.20,
        "platform_fit": 0.15,
        "risk_control": 0.10,
    }

    def combine(
        self,
        rule_result: RuleResult,
        model_scores: dict[str, float | dict],
    ) -> EvaluationResult:
        if set(model_scores) != set(self.weights):
            raise ValueError("model score dimensions do not match the rubric")
        dimensions = {}
        for name, raw in model_scores.items():
            if isinstance(raw, dict):
                dimensions[name] = DimensionResult.model_validate(raw)
            else:
                dimensions[name] = DimensionResult(
                    score=raw,
                    reason="模型按固定量表给出的分项判断。",
                )
        total = round(
            sum(dimensions[name].score * weight for name, weight in self.weights.items()),
            2,
        )
        return EvaluationResult(
            dimensions=dimensions,
            total=total,
            advisory=True,
            rule_passed=rule_result.passed,
            rule_evidence={
                "word_count": rule_result.word_count,
                "missing_facts": rule_result.missing_facts,
                "banned_hits": rule_result.banned_hits,
                "length_ok": rule_result.length_ok,
            },
        )
