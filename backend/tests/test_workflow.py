from app.services.workflow import WorkflowMachine


def test_retry_starts_at_failed_step_and_keeps_completed_outputs():
    machine = WorkflowMachine(["facts", "outline", "draft", "adapt"])
    machine.complete("facts", {"facts": ["活动共100人参与"]})
    machine.fail("outline", "invalid json")

    retry = machine.retry_plan()

    assert retry == ["outline", "draft", "adapt"]
    assert machine.output("facts") == {"facts": ["活动共100人参与"]}
