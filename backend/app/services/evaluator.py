from pydantic import BaseModel, Field

from app.services.rules import RuleResult


class EvaluationResult(BaseModel):
    scores: dict[str, float]
    total: float = Field(ge=0, le=100)
    advisory: bool = True
    rule_passed: bool


class EvaluationService:
    weights = {
        "factual_accuracy": 0.35,
        "structure": 0.20,
        "readability": 0.20,
        "platform_fit": 0.15,
        "risk_control": 0.10,
    }

    def combine(
        self, rule_result: RuleResult, model_scores: dict[str, float]
    ) -> EvaluationResult:
        if set(model_scores) != set(self.weights):
            raise ValueError("model score dimensions do not match the rubric")
        if any(score < 0 or score > 100 for score in model_scores.values()):
            raise ValueError("scores must be between 0 and 100")
        total = round(
            sum(model_scores[name] * weight for name, weight in self.weights.items()),
            2,
        )
        return EvaluationResult(
            scores=model_scores,
            total=total,
            advisory=True,
            rule_passed=rule_result.passed,
        )
