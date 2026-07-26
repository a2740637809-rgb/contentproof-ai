import re
from collections import Counter

from pydantic import BaseModel, Field


class FeedbackInput(BaseModel):
    id: str
    channel: str
    text: str = Field(min_length=1)


class Evidence(BaseModel):
    id: str
    channel: str
    text: str


class SignalCluster(BaseModel):
    theme: str
    count: int
    opportunity_score: int
    channels: dict[str, int]
    evidence: list[Evidence]
    action: str


class ContentBrief(BaseModel):
    problem: str
    audience_signal: str
    evidence_ids: list[str]
    content_goal: str
    acceptance_criteria: list[str]


class SignalAnalyzer:
    themes = {
        "事实可信": ["错误", "不准", "来源", "核实", "真假", "编造"],
        "效率体验": ["慢", "等待", "卡", "步骤", "重复", "效率"],
        "内容质量": ["空洞", "模板", "像ai", "机械", "标题", "可读"],
        "功能诉求": ["希望", "支持", "能不能", "增加", "导出", "批量"],
        "隐私安全": ["隐私", "上传", "泄露", "本地", "敏感", "权限"],
    }
    actions = {
        "事实可信": "增加来源引用、核验状态与发布前质量门禁。",
        "效率体验": "显示步骤进度，支持缓存与失败重试。",
        "内容质量": "建立样例集和提示词对照，保留人工终审。",
        "功能诉求": "按频次和影响验证需求，交付最小闭环。",
        "隐私安全": "默认本地处理，明确脱敏和数据边界。",
        "其他反馈": "补充访谈上下文后再进入路线图。",
    }
    negative = ["差", "慢", "错", "不准", "空洞", "机械", "麻烦", "泄露", "卡"]
    high_impact = ["无法", "不能", "丢失", "泄露", "错误", "崩溃"]

    def analyze(self, items: list[FeedbackInput]) -> list[SignalCluster]:
        grouped: dict[str, list[Evidence]] = {}
        for item in items:
            evidence = Evidence(
                id=item.id, channel=item.channel, text=self._redact(item.text.strip())
            )
            grouped.setdefault(self._classify(evidence.text), []).append(evidence)
        total = max(len(items), 1)
        clusters = []
        for theme, evidence in grouped.items():
            negative = sum(
                any(word in item.text for word in self.negative) for item in evidence
            )
            impact = sum(
                any(word in item.text for word in self.high_impact) for item in evidence
            )
            score = round(
                len(evidence) / total * 50
                + negative / len(evidence) * 30
                + min(impact * 10, 20)
            )
            clusters.append(
                SignalCluster(
                    theme=theme,
                    count=len(evidence),
                    opportunity_score=min(score, 100),
                    channels=dict(Counter(item.channel for item in evidence)),
                    evidence=evidence,
                    action=self.actions[theme],
                )
            )
        return sorted(
            clusters,
            key=lambda cluster: (-cluster.opportunity_score, -cluster.count, cluster.theme),
        )

    def create_brief(self, cluster: SignalCluster) -> ContentBrief:
        return ContentBrief(
            problem=cluster.theme,
            audience_signal=f"{cluster.count} 条反馈集中指向“{cluster.theme}”",
            evidence_ids=[item.id for item in cluster.evidence],
            content_goal=cluster.action,
            acceptance_criteria=[
                "每个关键结论可回溯到原话证据",
                "事实和来源状态清晰可见",
                "人工终审",
            ],
        )

    def _classify(self, text: str) -> str:
        lowered = text.lower()
        scores = {
            theme: sum(word in lowered for word in words)
            for theme, words in self.themes.items()
        }
        theme, score = max(scores.items(), key=lambda item: item[1])
        return theme if score else "其他反馈"

    @staticmethod
    def _redact(text: str) -> str:
        text = re.sub(r"1[3-9]\d{9}", "[手机号]", text)
        return re.sub(
            r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}",
            "[邮箱]",
            text,
        )
