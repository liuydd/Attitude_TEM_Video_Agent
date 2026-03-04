import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException

from app.config import settings
from app.schemas.participant import ParticipantCreate, ParticipantResponse
from app.store import store

router = APIRouter(prefix="/participants", tags=["participants"])


def _participants_path():
    return settings.metadata_dir / "participants.json"


@router.post("", response_model=ParticipantResponse, status_code=201)
async def create_participant(data: ParticipantCreate) -> dict:
    items = store.load_all(_participants_path())

    # Check for duplicate student_id
    if store.find_by_field(items, "student_id", data.student_id):
        raise HTTPException(status_code=409, detail="student_id already exists")

    now = datetime.now(UTC).isoformat()
    item = {
        "id": str(uuid.uuid4()),
        **data.model_dump(),
        "created_at": now,
    }
    store.append_item(_participants_path(), item)
    return item
