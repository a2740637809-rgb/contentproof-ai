from collections import Counter


def classification_report(expected: list[str], predicted: list[str]) -> dict:
    if len(expected) != len(predicted):
        raise ValueError("expected and predicted must have equal length")
    labels = sorted(set(expected) | set(predicted))
    scores: dict[str, dict[str, float]] = {}
    for label in labels:
        true_positive = sum(
            truth == label and guess == label
            for truth, guess in zip(expected, predicted, strict=True)
        )
        false_positive = sum(
            truth != label and guess == label
            for truth, guess in zip(expected, predicted, strict=True)
        )
        false_negative = sum(
            truth == label and guess != label
            for truth, guess in zip(expected, predicted, strict=True)
        )
        precision = (
            true_positive / (true_positive + false_positive)
            if true_positive + false_positive
            else 0.0
        )
        recall = (
            true_positive / (true_positive + false_negative)
            if true_positive + false_negative
            else 0.0
        )
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        scores[label] = {
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1": round(f1, 4),
            "support": Counter(expected)[label],
        }
    correct = sum(
        truth == guess for truth, guess in zip(expected, predicted, strict=True)
    )
    return {
        "cases": len(expected),
        "accuracy": round(correct / len(expected), 4) if expected else 1.0,
        "macro_f1": round(
            sum(item["f1"] for item in scores.values()) / len(scores), 4
        )
        if scores
        else 1.0,
        "labels": scores,
    }


def evidence_coverage(expected_ids: list[str], output_ids: list[str]) -> float:
    if not expected_ids:
        return 1.0
    return round(len(set(expected_ids) & set(output_ids)) / len(set(expected_ids)), 4)
