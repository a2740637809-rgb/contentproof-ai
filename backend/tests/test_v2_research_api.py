from io import BytesIO

from docx import Document


def create_project(client):
    response = client.post(
        "/api/v2/projects",
        json={"name": "端午报道评论研究", "goal": "寻找下一篇解释型报道的选题"},
    )
    assert response.status_code == 201
    return response.json()


def test_project_can_be_renamed_archived_trashed_restored_and_deleted(client):
    project = create_project(client)
    project_id = project["id"]

    renamed = client.patch(
        f"/api/v2/projects/{project_id}",
        json={"name": "更新后的研究", "goal": "验证项目生命周期"},
    )
    assert renamed.status_code == 200
    assert renamed.json()["name"] == "更新后的研究"

    archived = client.post(f"/api/v2/projects/{project_id}/archive")
    assert archived.status_code == 200
    assert archived.json()["lifecycle"] == "archived"

    trashed = client.post(f"/api/v2/projects/{project_id}/trash")
    assert trashed.status_code == 200
    assert trashed.json()["lifecycle"] == "trashed"
    assert client.get("/api/v2/projects").json()["items"] == []
    assert client.get("/api/v2/projects?lifecycle=trashed").json()["items"][0]["id"] == project_id

    restored = client.post(f"/api/v2/projects/{project_id}/restore")
    assert restored.status_code == 200
    assert restored.json()["lifecycle"] == "active"

    deleted = client.delete(f"/api/v2/projects/{project_id}?permanent=true")
    assert deleted.status_code == 204
    assert client.get(f"/api/v2/projects/{project_id}").status_code == 404


def test_demo_bootstrap_is_idempotent_and_contains_complete_research(client):
    first = client.post("/api/v2/demo/bootstrap")
    second = client.post("/api/v2/demo/bootstrap")

    assert first.status_code == 201
    assert second.status_code == 200
    assert first.json()["project_id"] == second.json()["project_id"]
    assert first.json()["created"] is True
    assert second.json()["created"] is False

    project_id = first.json()["project_id"]
    comments = client.get(f"/api/v2/projects/{project_id}/comments").json()
    runs = client.get(f"/api/v2/projects/{project_id}/analysis-runs").json()
    benchmark = client.get(f"/api/v2/projects/{project_id}/benchmark").json()
    briefs = client.get(f"/api/v2/projects/{project_id}/briefs").json()
    assert comments["total"] == 8
    assert runs["items"]
    assert len(benchmark["strategies"]) == 2
    assert briefs["items"]


def test_model_profiles_can_be_managed_and_tested_without_exposing_secrets(client):
    created = client.post(
        "/api/v2/model-profiles",
        json={
            "name": "本地规则基线",
            "provider": "rules",
            "base_url": "",
            "model": "deterministic-v1",
            "embedding_model": "browser-rules",
            "secret_env": "CONTENT_LAB_TEST_KEY",
            "enabled": True,
        },
    )
    assert created.status_code == 201
    profile = created.json()
    assert "api_key" not in profile
    assert profile["secret_configured"] is False

    tested = client.post(f"/api/v2/model-profiles/{profile['id']}/test")
    assert tested.status_code == 200
    assert tested.json()["ok"] is True
    assert tested.json()["models"] == ["deterministic-v1"]

    disabled = client.patch(
        f"/api/v2/model-profiles/{profile['id']}", json={"enabled": False}
    )
    assert disabled.status_code == 200
    assert disabled.json()["enabled"] is False
    assert client.get("/api/v2/model-profiles").json()["items"]


def test_project_import_clean_analyze_review_and_export(client):
    project = create_project(client)
    project_id = project["id"]

    imported = client.post(
        f"/api/v2/projects/{project_id}/imports/manual",
        json={
            "article_title": "端午活动说明",
            "comments": [
                "什么时候可以报名？",
                "在哪里预约参加？",
                "需要准备什么材料？",
                "老人可以参加吗？",
                "活动具体在哪个地方举行？",
                "报名入口在哪里？",
                "联系电话13800138000",
                "什么时候可以报名？",
            ],
        },
    )
    assert imported.status_code == 201
    assert imported.json()["created"] == 7
    assert imported.json()["duplicates"] == 1

    comments = client.get(f"/api/v2/projects/{project_id}/comments").json()
    assert len(comments["items"]) == 7
    assert any("138****8000" in item["cleaned_text"] for item in comments["items"])
    assert all(item["raw_text"] for item in comments["items"])

    analysis = client.post(f"/api/v2/projects/{project_id}/analysis", json={})
    assert analysis.status_code == 201
    run = analysis.json()
    assert run["status"] == "completed"
    assert run["themes"]
    assert all(theme["status"] == "pending_review" for theme in run["themes"])
    assert all(theme["comment_ids"] for theme in run["themes"])

    theme_id = run["themes"][0]["id"]
    renamed = client.patch(
        f"/api/v2/themes/{theme_id}",
        json={"name": "活动参与流程", "status": "confirmed"},
    )
    assert renamed.status_code == 200
    assert renamed.json()["name"] == "活动参与流程"

    brief = client.post(f"/api/v2/projects/{project_id}/briefs", json={})
    assert brief.status_code == 201
    assert brief.json()["version"] == 1
    assert brief.json()["evidence_comment_ids"]

    markdown = client.get(
        f"/api/v2/briefs/{brief.json()['id']}/export/markdown"
    )
    assert markdown.status_code == 200
    assert "活动参与流程" in markdown.text

    docx = client.get(f"/api/v2/briefs/{brief.json()['id']}/export/docx")
    assert docx.status_code == 200
    document = Document(BytesIO(docx.content))
    assert document.paragraphs


def test_excluded_comments_are_reversible_and_not_analyzed(client):
    project_id = create_project(client)["id"]
    client.post(
        f"/api/v2/projects/{project_id}/imports/manual",
        json={"comments": ["怎么买票？", "广告加微信abc123", "费用是多少？"]},
    )
    comments = client.get(f"/api/v2/projects/{project_id}/comments").json()["items"]
    advertisement = next(item for item in comments if "微信" in item["raw_text"])
    assert advertisement["status"] == "excluded"

    restored = client.post(f"/api/v2/comments/{advertisement['id']}/restore")
    assert restored.status_code == 200
    assert restored.json()["status"] == "included"


def test_csv_import_reports_missing_comment_column(client):
    project_id = create_project(client)["id"]
    response = client.post(
        f"/api/v2/projects/{project_id}/imports/spreadsheet",
        files={"file": ("comments.csv", "name,date\nA,2026-01-01", "text/csv")},
    )
    assert response.status_code == 422
    assert "评论列" in response.json()["detail"]


def test_brief_requires_confirmed_theme(client):
    project_id = create_project(client)["id"]
    client.post(
        f"/api/v2/projects/{project_id}/imports/manual",
        json={"comments": ["怎么报名？", "报名入口在哪？", "需要什么材料？"]},
    )
    client.post(f"/api/v2/projects/{project_id}/analysis", json={})
    response = client.post(f"/api/v2/projects/{project_id}/briefs", json={})
    assert response.status_code == 409
    assert "确认" in response.json()["detail"]


def test_analysis_run_exposes_agent_trace_and_reproducible_metrics(client):
    project_id = create_project(client)["id"]
    client.post(
        f"/api/v2/projects/{project_id}/imports/manual",
        json={
            "comments": [
                "什么时候报名？",
                "报名入口在哪里？",
                "需要准备什么材料？",
                "广告加微信abc123",
            ]
        },
    )
    created = client.post(f"/api/v2/projects/{project_id}/analysis", json={})
    assert created.status_code == 201

    response = client.get(f"/api/v2/projects/{project_id}/analysis-runs")

    assert response.status_code == 200
    payload = response.json()
    assert payload["items"][0]["status"] == "completed"
    assert [step["key"] for step in payload["items"][0]["steps"]] == [
        "collect",
        "clean",
        "cluster",
        "verify",
    ]
    assert payload["items"][0]["steps"][1]["metrics"]["excluded"] == 1
    assert payload["items"][0]["metrics"]["evidence_coverage"] == 1.0
    assert payload["items"][0]["human_gate"]["required"] is True


def test_benchmark_compares_methods_using_observed_project_data(client):
    project_id = create_project(client)["id"]
    client.post(
        f"/api/v2/projects/{project_id}/imports/manual",
        json={
            "comments": [
                "什么时候报名？",
                "报名入口在哪里？",
                "需要准备什么材料？",
                "现场停车方便吗？",
            ]
        },
    )
    client.post(f"/api/v2/projects/{project_id}/analysis", json={})

    response = client.get(f"/api/v2/projects/{project_id}/benchmark")

    assert response.status_code == 200
    payload = response.json()
    assert [item["key"] for item in payload["strategies"]] == [
        "keyword_baseline",
        "latest_analysis",
    ]
    assert all(0 <= item["evidence_coverage"] <= 1 for item in payload["strategies"])
    assert payload["note"] == "结果来自当前项目数据，不代表通用模型准确率。"


def test_theme_merge_split_and_move_preserve_evidence(client):
    project_id = create_project(client)["id"]
    client.post(
        f"/api/v2/projects/{project_id}/imports/manual",
        json={
            "comments": [
                "什么时候报名？",
                "报名入口在哪里？",
                "活动在哪里举行？",
                "具体地点怎么走？",
                "需要准备什么材料？",
            ]
        },
    )
    run = client.post(f"/api/v2/projects/{project_id}/analysis", json={}).json()
    first, second = run["themes"][:2]

    merged = client.post(
        f"/api/v2/themes/{first['id']}/merge",
        json={"source_theme_ids": [second["id"]], "name": "参与信息总览"},
    )
    assert merged.status_code == 200
    assert set(merged.json()["comment_ids"]) == set(
        first["comment_ids"] + second["comment_ids"]
    )

    moved_comment = merged.json()["comment_ids"][-1]
    split = client.post(
        f"/api/v2/themes/{first['id']}/split",
        json={"name": "单独问题", "comment_ids": [moved_comment]},
    )
    assert split.status_code == 201
    assert split.json()["comment_ids"] == [moved_comment]

    moved = client.post(
        f"/api/v2/comments/{moved_comment}/move",
        json={"target_theme_id": first["id"]},
    )
    assert moved.status_code == 200
    assert moved_comment in moved.json()["comment_ids"]

    history = client.get(f"/api/v2/projects/{project_id}/review-events")
    assert history.status_code == 200
    assert {item["action"] for item in history.json()["items"]} >= {
        "merge",
        "split",
        "move_comment",
    }


def test_web_import_reports_article_and_comments_separately(client, monkeypatch):
    project_id = create_project(client)["id"]

    def fake_extract(url):
        return {
            "title": "公开报道",
            "body": "这是一篇公开报道的正文。",
            "author": "编辑部",
            "published_at": "2026-07-27",
            "comments": [],
            "article_status": "success",
            "comments_status": "unavailable",
            "warnings": ["页面未提供公开可访问评论，请粘贴或上传评论。"],
        }

    monkeypatch.setattr("app.v2_api.extract_public_page", fake_extract)
    response = client.post(
        f"/api/v2/projects/{project_id}/imports/web",
        json={"url": "https://example.com/article"},
    )
    assert response.status_code == 201
    assert response.json()["article_status"] == "success"
    assert response.json()["comments_status"] == "unavailable"
    assert response.json()["warnings"]
