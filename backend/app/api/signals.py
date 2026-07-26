from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.signals import FeedbackInput, SignalAnalyzer

router = APIRouter(prefix="/api/signals", tags=["signals"])


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
