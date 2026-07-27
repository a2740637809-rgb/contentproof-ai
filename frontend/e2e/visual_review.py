import json
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright


API = "http://127.0.0.1:8000/api/v2"
OUT = Path(__file__).resolve().parent / "artifacts"
OUT.mkdir(exist_ok=True)


def request(path, method="GET", data=None):
    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(
        f"{API}{path}",
        data=body,
        method=method,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as response:
        return json.load(response)


projects = request("/projects")["items"]
if projects:
    project = projects[0]
else:
    project = request(
        "/projects",
        "POST",
        {"name": "端午报道评论研究", "goal": "找到读者真正关心、值得继续解释的问题"},
    )
    request(
        f"/projects/{project['id']}/imports/manual",
        "POST",
        {
            "comments": [
                "活动什么时候开始报名？",
                "报名入口在哪里，手机上能操作吗？",
                "老人也可以参加吗，需要家属陪同吗？",
                "参加活动需要准备身份证吗？",
                "现场有没有停车的位置？",
                "外地游客能不能报名？",
                "建议把时间、地点和报名方式一次说清楚。",
                "加微信领取福利",
            ]
        },
    )
    request(f"/projects/{project['id']}/analysis", "POST", {"mode": "preview"})

console_errors = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1600, "height": 1000}, device_scale_factor=1)
    page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
    page.goto("http://127.0.0.1:5173", wait_until="networkidle")
    page.screenshot(path=str(OUT / "01-project-home.png"), full_page=True)
    page.get_by_role("button", name="打开研究").first.click()
    page.wait_for_load_state("networkidle")
    page.screenshot(path=str(OUT / "02-overview.png"), full_page=True)
    page.get_by_role("button", name="洞察审阅", exact=False).first.click()
    page.wait_for_timeout(300)
    page.screenshot(path=str(OUT / "03-evidence-review.png"), full_page=True)
    assert page.get_by_text("原始证据").is_visible()
    merge = page.get_by_role("button", name="合并")
    if merge.is_enabled():
        merge.click()
        assert page.get_by_role("dialog", name="合并候选主题").is_visible()
        page.get_by_role("button", name="关闭").click()
    assert not console_errors, console_errors
    browser.close()

print(json.dumps({"project_id": project["id"], "screenshots": 3, "console_errors": console_errors}, ensure_ascii=False))
