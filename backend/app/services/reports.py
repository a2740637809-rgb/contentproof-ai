import csv
import io


def render_markdown_report(
    title: str,
    total: float,
    scores: dict[str, float],
    decision: str,
) -> str:
    lines = [
        f"# {title} 评测报告",
        "",
        "> 模型辅助评分，仅供参考；最终判断由人工终审完成。",
        "",
        f"- 总分：{total}",
        f"- 人工决定：{decision}",
        "",
        "## 分项得分",
    ]
    for name, score in scores.items():
        if isinstance(score, dict):
            lines.append(f"- {name}: {score.get('score')} — {score.get('reason', '')}")
        else:
            lines.append(f"- {name}: {score}")
    return "\n".join(lines) + "\n"


def render_csv_rows(rows: list[dict]) -> str:
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=list(rows[0]) if rows else [])
    if rows:
        writer.writeheader()
        writer.writerows(rows)
    return output.getvalue()
