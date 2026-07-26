from app.services.reports import render_markdown_report


def test_markdown_report_labels_model_score_as_advisory():
    report = render_markdown_report(
        title="端午反诈活动稿",
        total=80.5,
        scores={"factual_accuracy": 90},
        decision="modified",
    )

    assert "模型辅助评分，仅供参考" in report
    assert "80.5" in report
