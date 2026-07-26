def test_signal_analysis_api_returns_clusters_and_brief(client):
    response = client.post(
        "/api/signals/analyze",
        json={
            "items": [
                {"id": "F1", "channel": "访谈", "text": "内容空洞，像AI模板"},
                {"id": "F2", "channel": "评论", "text": "标题太机械，可读性差"},
            ]
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["clusters"][0]["theme"] == "内容质量"
    assert payload["brief"]["evidence_ids"] == ["F1", "F2"]
    assert payload["mode"] == "deterministic"
