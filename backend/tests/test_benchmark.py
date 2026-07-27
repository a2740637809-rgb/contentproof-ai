from app.evaluation.metrics import classification_report, evidence_coverage


def test_classification_report_exposes_per_label_and_macro_accuracy():
    report = classification_report(
        expected=["事实可信", "事实可信", "流程韧性", "本地隐私"],
        predicted=["事实可信", "内容质量", "流程韧性", "本地隐私"],
    )

    assert report["accuracy"] == 0.75
    assert report["labels"]["事实可信"]["recall"] == 0.5
    assert 0 <= report["macro_f1"] <= 1


def test_evidence_coverage_measures_traceable_output_ids():
    assert evidence_coverage(["E-001", "E-002"], ["E-001"]) == 0.5
    assert evidence_coverage([], []) == 1.0
