from app.services.signals import FeedbackInput, SignalAnalyzer


def test_signal_analysis_redacts_and_preserves_evidence_ids():
    result = SignalAnalyzer().analyze(
        [
            FeedbackInput(id="F1", channel="访谈", text="事实不准，联系13800138000"),
            FeedbackInput(id="F2", channel="评论", text="看不到来源，无法核实"),
            FeedbackInput(id="F3", channel="客服", text="希望支持批量导出"),
        ]
    )

    factual = next(cluster for cluster in result if cluster.theme == "事实可信")
    assert factual.count == 2
    assert factual.opportunity_score > 0
    assert factual.evidence[0].id == "F1"
    assert factual.evidence[0].text == "事实不准，联系[手机号]"
    assert factual.action


def test_cluster_becomes_a_traceable_content_brief():
    analyzer = SignalAnalyzer()
    clusters = analyzer.analyze(
        [
            FeedbackInput(id="F1", channel="访谈", text="内容空洞，像AI模板"),
            FeedbackInput(id="F2", channel="评论", text="标题太机械，可读性差"),
        ]
    )

    brief = analyzer.create_brief(clusters[0])

    assert brief.problem == "内容质量"
    assert brief.evidence_ids == ["F1", "F2"]
    assert "人工终审" in brief.acceptance_criteria
