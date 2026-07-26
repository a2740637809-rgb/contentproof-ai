import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app import models  # noqa: E402, F401
from app.db import Base, SessionLocal, engine  # noqa: E402
from app.repositories import PromptRepository  # noqa: E402
from app.schemas import PromptCreate  # noqa: E402


def main() -> None:
    Base.metadata.create_all(engine)
    prompts = json.loads(
        (ROOT / "data/prompt_versions.json").read_text(encoding="utf-8")
    )
    with SessionLocal() as session:
        repository = PromptRepository(session)
        for item in prompts:
            repository.create_version(
                PromptCreate(
                    name=item["name"],
                    step=item["step"],
                    template=item["template"],
                    change_note=item["change_note"],
                )
            )


if __name__ == "__main__":
    main()
