from dataclasses import dataclass, field


@dataclass
class StepState:
    name: str
    status: str = "pending"
    output: dict = field(default_factory=dict)
    error: str = ""


class WorkflowMachine:
    def __init__(self, names: list[str]):
        self.steps = [StepState(name=name) for name in names]

    def _step(self, name: str) -> StepState:
        return next(step for step in self.steps if step.name == name)

    def complete(self, name: str, output: dict) -> None:
        step = self._step(name)
        step.status = "completed"
        step.output = output
        step.error = ""

    def fail(self, name: str, error: str) -> None:
        step = self._step(name)
        step.status = "failed"
        step.error = error

    def retry_plan(self) -> list[str]:
        failed_index = next(
            i for i, step in enumerate(self.steps) if step.status == "failed"
        )
        return [step.name for step in self.steps[failed_index:]]

    def output(self, name: str) -> dict:
        return self._step(name).output
