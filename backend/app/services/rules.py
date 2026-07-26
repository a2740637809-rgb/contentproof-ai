from pydantic import BaseModel


class RuleResult(BaseModel):
    word_count: int
    missing_facts: list[str]
    banned_hits: list[str]
    length_ok: bool
    passed: bool


class RuleEngine:
    def evaluate(
        self,
        text: str,
        required_facts: list[str],
        banned_phrases: list[str],
        min_words: int,
        max_words: int,
    ) -> RuleResult:
        word_count = len(text)
        missing = [fact for fact in required_facts if fact not in text]
        banned = [phrase for phrase in banned_phrases if phrase in text]
        length_ok = min_words <= word_count <= max_words
        return RuleResult(
            word_count=word_count,
            missing_facts=missing,
            banned_hits=banned,
            length_ok=length_ok,
            passed=not missing and not banned and length_ok,
        )
