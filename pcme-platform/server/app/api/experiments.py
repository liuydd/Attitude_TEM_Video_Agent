import uuid
from datetime import UTC, datetime

from fastapi import APIRouter

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
