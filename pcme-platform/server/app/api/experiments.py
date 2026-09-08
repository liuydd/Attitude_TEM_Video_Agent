import json
import re
import uuid
from datetime import UTC, datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException

from app.config import settings
from app.schemas.experiment import ExperimentCreate, ExperimentList, ExperimentResponse
from app.store import store

router = APIRouter(prefix="/experiments", tags=["experiments"])


def _experiments_path():
    return settings.metadata_dir / "experiments.json"


@router.post("", response_model=ExperimentResponse, status_code=201)
async def create_experiment(data: ExperimentCreate) -> dict:
    now = datetime.now(UTC).isoformat()
    item = {
        "id": str(uuid.uuid4()),
        **data.model_dump(),
        "created_at": now,
        "updated_at": now,
    }
    store.append_item(_experiments_path(), item)
    return item


@router.get("", response_model=ExperimentList)
async def list_experiments() -> dict:
    items = store.load_all(_experiments_path())
    # Sort by created_at descending (newest first)
    items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return {"items": items, "total": len(items)}


@router.get("/{experiment_id}/discussion-points")
async def get_discussion_points(experiment_id: uuid.UUID) -> dict:
    """Return pause points and prompts encoded in the selected video timeline."""
    experiment = store.find_by_field(
        store.load_all(_experiments_path()), "id", str(experiment_id)
    )
    if experiment is None:
        raise HTTPException(404, "Experiment not found")
    filename = Path(experiment["training_video_filename"]).stem
    timeline_path = settings.data_dir / "timelines" / f"{filename}.json"
    if not timeline_path.exists():
        return {"items": []}
    points = []
    for index, item in enumerate(json.loads(timeline_path.read_text(encoding="utf-8")), 1):
        match = re.search(r"第(\d+(?:\.\d+)?)s后.*?主题[：:]([^。]+)", item.get("description", ""))
        if match:
            points.append({"id": index, "pause_sec": float(match.group(1)), "prompt": match.group(2).strip()})
    return {"items": points}
