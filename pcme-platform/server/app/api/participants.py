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

    participant_id = uuid.uuid4()
    student_id = data.student_id or f"participant-{participant_id.hex}"

    # Keep manually supplied identifiers unique; generated identifiers are UUID-based.
    if store.find_by_field(items, "student_id", student_id):
        raise HTTPException(status_code=409, detail="student_id already exists")

    now = datetime.now(UTC).isoformat()
    item = {
        "id": str(participant_id),
        **data.model_dump(exclude={"student_id"}),
        "student_id": student_id,
        "created_at": now,
    }
    store.append_item(_participants_path(), item)
    return item
