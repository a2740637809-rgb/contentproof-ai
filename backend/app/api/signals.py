from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.signals import FeedbackInput, SignalAnalyzer

router = APIRouter(prefix="/api/signals", tags=["signals"])
v2_router = APIRouter(prefix="/api/v2/signals", tags=["signals-v2"])


class SignalAnalysisRequest(BaseModel):
    items: list[FeedbackInput] = Field(min_length=1)


@router.post("/analyze")
def analyze_signals(data: SignalAnalysisRequest) -> dict:
    analyzer = SignalAnalyzer()
    clusters = analyzer.analyze(data.items)
    return {
        "mode": "deterministic",
        "clusters": [cluster.model_dump() for cluster in clusters],
        "brief": analyzer.create_brief(clusters[0]).model_dump(),
    }


@v2_router.post("/analyze")
def analyze_signals_v2(data: SignalAnalysisRequest) -> dict:
    analyzer = SignalAnalyzer()
    clusters = analyzer.analyze(data.items)
    signals = []
    for index, cluster in enumerate(clusters, start=1):
        words = analyzer.themes.get(cluster.theme, [])
        matched = [
            word
            for word in words
            if any(word in item.text.lower() for item in cluster.evidence)
        ]
        confidence = min(
            0.95,
            round(0.45 + len(matched) * 0.08 + len(cluster.evidence) * 0.04, 2),
        )
        signals.append(
            {
                "id": f"S-{index:03d}",
                "theme": cluster.theme,
                "confidence": confidence,
                "rationale": (
                    f"命中“{'、'.join(matched)}”等可检查线索。"
                    if matched
                    else "规则基线未命中已定义主题，需要人工判断。"
                ),
                "action": cluster.action,
                "evidence": [item.model_dump() for item in cluster.evidence],
            }
        )
    return {"mode": "rules-v1", "signals": signals}
