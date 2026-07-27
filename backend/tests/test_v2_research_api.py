from io import BytesIO

from docx import Document


def create_project(client):
    response = client.post(
        "/api/v2/projects",
        json={"name": "端午报道评论研究", "goal": "寻找下一篇解释型报道的选题"},
    )
    assert response.status_code == 201
    return response.json()


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
