def test_full_task_evaluation_review_and_export_flow(client):
    task = client.post(
        "/api/tasks",
        json={
            "title": "端午反诈活动稿",
            "content_type": "活动新闻",
            "target_platform": "常德融媒",
            "audience": "常德市民",
            "tone": "准确、清晰",
            "min_words": 4,
            "max_words": 700,
            "banned_phrases": ["据网传"],
        },
    )
    prompt = client.post(
        "/api/prompts",
        json={"name": "draft", "step": "draft", "template": "依据事实卡片写稿"},
    )
    assert task.status_code == prompt.status_code == 201
    task_id = task.json()["id"]

    source = client.post(
        f"/api/tasks/{task_id}/sources",
        json={
            "title": "公开报道",
            "url": "https://example.com/report",
            "excerpt": "活动吸引200人参与。",
            "facts": [{"text": "活动吸引200人参与"}],
        },
    )
    run = client.post(
        f"/api/tasks/{task_id}/runs",
        json={"prompt_version_id": prompt.json()["id"], "model_name": "qwen2:1.5b"},
    )
    assert source.status_code == run.status_code == 201
    run_id = run.json()["id"]
    assert client.post(f"/api/runs/{run_id}/retry").status_code == 409

    evaluation = client.post(
        f"/api/runs/{run_id}/evaluate",
        json={
            "required_facts": ["活动吸引200人参与"],
            "text": "活动吸引200人参与。",
            "model_scores": {
                "factual_accuracy": 90,
                "structure": 80,
                "readability": 70,
                "platform_fit": 60,
                "risk_control": 100,
            },
        },
    )
    review = client.post(
        f"/api/runs/{run_id}/reviews",
        json={"decision": "modified", "reason_tags": ["精简"], "final_text": "终稿"},
    )
    assert evaluation.json()["total"] == 80.5
    assert review.json()["decision"] == "modified"
    assert "模型辅助评分，仅供参考" in client.get(
        f"/api/runs/{run_id}/report.md"
    ).text
    assert "total_score" in client.get(
        f"/api/tasks/{task_id}/experiments.csv"
    ).text
