import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_public_fixture_is_complete_and_does_not_embed_full_articles():
    samples = json.loads(
        (ROOT / "data/public_samples.json").read_text(encoding="utf-8")
    )
    cases = json.loads(
        (ROOT / "data/evaluation_cases.json").read_text(encoding="utf-8")
    )
    prompts = json.loads(
        (ROOT / "data/prompt_versions.json").read_text(encoding="utf-8")
    )

    assert len(samples) == 4
    assert len(cases) >= 20
    assert len(prompts) >= 2
    assert all(len(sample["excerpt"]) <= 180 for sample in samples)
    assert all(
        sample["url"].startswith("https://appimg.cdyee.com/") for sample in samples
    )
    assert sum(case["kind"] == "verified_public_sample" for case in cases) == 4
    assert sum(case["kind"] == "explicit_failure" for case in cases) == 4
