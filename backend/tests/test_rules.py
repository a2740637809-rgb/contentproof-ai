from app.services.rules import RuleEngine


def test_rules_find_unsupported_required_fact_and_banned_phrase():
    result = RuleEngine().evaluate(
        text="据网传，活动在万达广场举行。",
        required_facts=["活动吸引200人参与"],
        banned_phrases=["据网传"],
        min_words=1,
        max_words=100,
    )

    assert result.missing_facts == ["活动吸引200人参与"]
    assert result.banned_hits == ["据网传"]
    assert result.passed is False
