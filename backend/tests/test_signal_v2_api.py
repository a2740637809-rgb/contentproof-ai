def test_signal_v2_returns_explanations_and_evidence_links(client):
    response = client.post(
        "/api/v2/signals/analyze",
        json={
            "items": [
                {
                    "id": "E-001",
                    "channel": "访谈",
                    "text": "文章事实写错了，也没有原始来源。",
                }
            ]
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["mode"] == "rules-v1"
    assert payload["signals"][0]["theme"] == "事实可信"
    assert payload["signals"][0]["evidence"][0]["id"] == "E-001"
    assert payload["signals"][0]["confidence"] > 0
    assert "命中" in payload["signals"][0]["rationale"]
