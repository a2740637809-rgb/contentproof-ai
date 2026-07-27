import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.evaluation.metrics import classification_report  # noqa: E402
from app.services.signals import FeedbackInput, SignalAnalyzer  # noqa: E402


def main() -> None:
    dataset_path = ROOT / "data" / "evaluation" / "signalproof-v1.jsonl"
    cases = [
        json.loads(line)
        for line in dataset_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    analyzer = SignalAnalyzer()
    expected, predicted = [], []
    failures = []
    for case in cases:
        cluster = analyzer.analyze(
            [FeedbackInput(id=case["id"], channel=case["channel"], text=case["text"])]
        )[0]
        expected.append(case["label"])
        predicted.append(cluster.theme)
        if cluster.theme != case["label"]:
            failures.append(
                {"id": case["id"], "expected": case["label"], "predicted": cluster.theme}
            )
    report = {
        "dataset": "signalproof-v1",
        "mode": "deterministic-keyword-baseline",
        **classification_report(expected, predicted),
        "failures": failures,
    }
    output = ROOT / "data" / "evaluation" / "baseline-report.json"
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
