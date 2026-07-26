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


def _create_task(client, title: str = "端午内容实验") -> dict:
    response = client.post(
        "/api/tasks",
        json={
            "title": title,
            "content_type": "活动新闻",
            "target_platform": "常德融媒",
            "audience": "常德市民",
            "tone": "准确、清晰",
            "min_words": 100,
            "max_words": 700,
            "banned_phrases": [],
        },
    )
    assert response.status_code == 201
    return response.json()


def test_product_read_models(client):
    task = _create_task(client)
    _create_task(client, title="第二个实验")
    source = client.post(
        f"/api/tasks/{task['id']}/sources",
        json={
            "title": "公开来源",
            "url": "https://example.com/source",
            "excerpt": "活动主题包含反诈与禁毒。",
            "facts": [{"text": "活动主题包含反诈与禁毒", "status": "verified"}],
        },
    ).json()
    prompt_v1 = client.post(
        "/api/prompts",
        json={"name": "draft", "step": "draft", "template": "版本一"},
    ).json()
    prompt_v2 = client.post(
        "/api/prompts",
        json={"name": "draft", "step": "draft", "template": "版本二"},
    ).json()
    run = client.post(
        f"/api/tasks/{task['id']}/runs",
        json={"prompt_version_id": prompt_v2["id"], "model_name": "qwen2:1.5b"},
    ).json()

    tasks = client.get("/api/tasks")
    detail = client.get(f"/api/tasks/{task['id']}")
    updated_task = client.patch(
        f"/api/tasks/{task['id']}",
        json={"tone": "客观、克制"},
    )
    updated_source = client.patch(
        f"/api/tasks/{task['id']}/sources/{source['id']}",
        json={"status": "verified"},
    )
    prompts = client.get("/api/prompts")
    run_detail = client.get(f"/api/runs/{run['id']}")
    dashboard = client.get("/api/dashboard")

    assert tasks.status_code == 200
    assert [item["title"] for item in tasks.json()] == ["第二个实验", "端午内容实验"]
    assert detail.json()["sources"][0]["id"] == source["id"]
    assert detail.json()["runs"][0]["id"] == run["id"]
    assert updated_task.json()["tone"] == "客观、克制"
    assert updated_source.json()["status"] == "verified"
    assert [item["version"] for item in prompts.json()] == [1, 2]
    assert run_detail.json()["steps"][0] == {
        "name": "facts",
        "position": 0,
        "status": "pending",
        "input_json": {},
        "output_json": {},
        "error": "",
        "started_at": None,
        "completed_at": None,
        "elapsed_ms": None,
    }
    assert dashboard.json() == {
        "task_count": 2,
        "run_count": 1,
        "completed_runs": 0,
        "failed_runs": 0,
        "reviewed_runs": 0,
        "average_score": None,
    }
    assert prompt_v1["version"] == 1


def test_delete_contracts(client):
    task = _create_task(client)
    prompt = client.post(
        "/api/prompts",
        json={"name": "draft", "step": "draft", "template": "写稿"},
    ).json()
    source = client.post(
        f"/api/tasks/{task['id']}/sources",
        json={
            "title": "来源",
            "url": "https://example.com",
            "excerpt": "公开摘要",
            "facts": [],
        },
    ).json()

    assert client.delete(
        f"/api/tasks/{task['id']}/sources/{source['id']}"
    ).status_code == 204
    client.post(
        f"/api/tasks/{task['id']}/runs",
        json={"prompt_version_id": prompt["id"], "model_name": "qwen2:1.5b"},
    )
    assert client.delete(f"/api/tasks/{task['id']}").status_code == 409
    assert client.delete(f"/api/tasks/{task['id']}?force=true").status_code == 204


def test_retry_specific_failed_step(client):
    task = _create_task(client)
    prompt = client.post(
        "/api/prompts",
        json={"name": "draft", "step": "draft", "template": "写稿"},
    ).json()
    run = client.post(
        f"/api/tasks/{task['id']}/runs",
        json={"prompt_version_id": prompt["id"], "model_name": "qwen2:1.5b"},
    ).json()

    response = client.post(f"/api/runs/{run['id']}/steps/outline/retry")

    assert response.status_code == 409
    assert response.json()["detail"] == "step is not failed"
