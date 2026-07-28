import json
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright


API = "http://127.0.0.1:8000/api/v2"
OUT = Path(__file__).resolve().parents[2] / "docs" / "assets"
OUT.mkdir(exist_ok=True)


def request(path, method="GET"):
    req = urllib.request.Request(f"{API}{path}", data=b"" if method == "POST" else None, method=method)
    with urllib.request.urlopen(req) as response:
        return json.load(response)


demo = request("/demo/bootstrap", "POST")
console_errors = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1600, "height": 1000}, device_scale_factor=1)
    page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
    page.goto("http://127.0.0.1:5173", wait_until="networkidle")
    page.screenshot(path=str(OUT / "content-intelligence-home.png"), full_page=True)

    page.get_by_role("button", name="加载完整示例").click()
    page.get_by_role("heading", name="今天需要做出的编辑判断").wait_for()
    page.screenshot(path=str(OUT / "content-intelligence-overview.png"), full_page=True)

    page.get_by_role("button", name="运行轨迹", exact=False).click()
    page.get_by_role("heading", name="AI 如何得出这些主题").wait_for()
    page.screenshot(path=str(OUT / "content-intelligence-trace.png"), full_page=True)

    page.get_by_role("button", name="方案对比", exact=False).click()
    page.get_by_role("heading", name="哪种分析方法更值得采用").wait_for()
    page.screenshot(path=str(OUT / "content-intelligence-benchmark.png"), full_page=True)

    page.get_by_role("button", name="模型中心", exact=False).click()
    page.get_by_role("heading", name="选择谁来完成分析").wait_for()
    page.screenshot(path=str(OUT / "content-intelligence-models.png"), full_page=True)

    mobile = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=1)
    mobile.goto("http://127.0.0.1:5173", wait_until="networkidle")
    mobile.screenshot(path=str(OUT / "content-intelligence-mobile.png"), full_page=True)

    assert not console_errors, console_errors
    browser.close()

print(json.dumps({
    "project_id": demo["project_id"],
    "screenshots": 6,
    "console_errors": console_errors,
}, ensure_ascii=False))
