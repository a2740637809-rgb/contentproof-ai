from app.services.evaluator import EvaluationService
from app.services.rules import RuleResult


def test_weighted_score_uses_fixed_dimensions_and_is_advisory():
    result = EvaluationService().combine(
        rule_result=RuleResult(
            word_count=500,
            missing_facts=[],
            banned_hits=[],
            length_ok=True,
            passed=True,
        ),
        model_scores={
            "factual_accuracy": 90,
            "structure": 80,
            "readability": 70,
            "platform_fit": 60,
            "risk_control": 100,
        },
    )

    assert result.total == 80.5
    assert result.advisory is True
