import hashlib
import json
import uuid
from datetime import UTC, datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile

from app.config import settings
from app.schemas.event import EventBatchResponse, EventBatchUpload
from app.schemas.questionnaire import QuestionnaireResponseSchema, QuestionnaireSubmit
from app.schemas.recording import RecordingResponse, TrackType
from app.schemas.session import SessionCreate, SessionResponse, SessionStatus, SessionUpdate
from app.store import store

router = APIRouter(prefix="/sessions", tags=["sessions"])


def _session_path(session_id: str) -> Path:
    return settings.metadata_dir / "sessions" / f"{session_id}.json"


def _get_session_or_404(session_id: uuid.UUID) -> dict:
    data = store.load_one(_session_path(str(session_id)))
    if not data:
        raise HTTPException(status_code=404, detail="Session not found")
    return data


@router.post("", response_model=SessionResponse, status_code=201)
async def create_session(data: SessionCreate) -> dict:
    now = datetime.now(UTC).isoformat()
    session_id = str(uuid.uuid4())

    # Look up experiment to record training_video_filename in session
    experiments = store.load_all(settings.metadata_dir / "experiments.json")
    exp = store.find_by_field(experiments, "id", str(data.experiment_id))
    training_video_filename = exp.get("training_video_filename") if exp else None

    # Create physio data folder for this session
    physio_session_dir = settings.physio_dir / session_id
    physio_session_dir.mkdir(parents=True, exist_ok=True)

    item = {
        "id": session_id,
        "experiment_id": str(data.experiment_id),
        "participant_id": str(data.participant_id),
        "status": SessionStatus.CREATED.value,
        "anchor_timestamp_ms": None,
        "started_at": None,
        "ended_at": None,
        "notes": data.notes,
        "training_video_filename": training_video_filename,
        "physio_data_path": str(physio_session_dir.relative_to(settings.data_dir)),
        "created_at": now,
        "updated_at": now,
        # Embedded sub-collections
        "recordings": [],
        "questionnaires": [],
        "event_batches": [],
    }
    store.save_one(_session_path(session_id), item)
    return item


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session_detail(session_id: uuid.UUID) -> dict:
    return _get_session_or_404(session_id)


@router.patch("/{session_id}", response_model=SessionResponse)
async def update_session(session_id: uuid.UUID, data: SessionUpdate) -> dict:
    session = _get_session_or_404(session_id)
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        # Convert enum values to strings for JSON serialization
        session[field] = value.value if hasattr(value, "value") else value
    session["updated_at"] = datetime.now(UTC).isoformat()
    store.save_one(_session_path(str(session_id)), session)
    return session


@router.post("/{session_id}/events", response_model=EventBatchResponse)
async def upload_events(session_id: uuid.UUID, data: EventBatchUpload) -> dict:
    session = _get_session_or_404(session_id)

    exp_id = session["experiment_id"]
    sess_id = str(session_id)
    log_dir = settings.logs_dir / exp_id / sess_id
    log_dir.mkdir(parents=True, exist_ok=True)

    # Append events to JSONL file
    log_file = log_dir / "events.jsonl"
    with open(log_file, "a", encoding="utf-8") as f:
        for event in data.events:
            f.write(json.dumps(event.model_dump(), ensure_ascii=False) + "\n")

    batch_id = str(uuid.uuid4())
    log_file_path = str(log_file.relative_to(settings.data_dir))

    # Record batch metadata in session JSON
    session.setdefault("event_batches", []).append(
        {
            "id": batch_id,
            "log_file_path": log_file_path,
            "event_count": len(data.events),
            "created_at": datetime.now(UTC).isoformat(),
        }
    )
    store.save_one(_session_path(sess_id), session)

    return {
        "batch_id": batch_id,
        "event_count": len(data.events),
        "log_file_path": log_file_path,
    }


@router.post("/{session_id}/recordings/upload", response_model=RecordingResponse)
async def upload_recording(
    session_id: uuid.UUID,
    file: UploadFile,
    track_type: TrackType,
) -> dict:
    session = _get_session_or_404(session_id)

    exp_id = session["experiment_id"]
    sess_id = str(session_id)
    rec_dir = settings.recordings_dir / exp_id / sess_id
    rec_dir.mkdir(parents=True, exist_ok=True)

    # Determine filename
    ext = Path(file.filename).suffix if file.filename else ".webm"
    dest = rec_dir / f"{track_type.value}{ext}"

    # Stream write + compute checksum
    sha256 = hashlib.sha256()
    file_size = 0
    with open(dest, "wb") as f:
        while chunk := await file.read(1024 * 1024):
            f.write(chunk)
            sha256.update(chunk)
            file_size += len(chunk)

    now = datetime.now(UTC).isoformat()
    recording = {
        "id": str(uuid.uuid4()),
        "session_id": sess_id,
        "track_type": track_type.value,
        "file_path": str(dest.relative_to(settings.data_dir)),
        "mime_type": file.content_type or "application/octet-stream",
        "file_size_bytes": file_size,
        "checksum_sha256": sha256.hexdigest(),
        "created_at": now,
    }

    # Record in session JSON
    session.setdefault("recordings", []).append(recording)
    store.save_one(_session_path(sess_id), session)

    return recording


@router.post("/{session_id}/questionnaires", response_model=QuestionnaireResponseSchema)
async def submit_questionnaire(
    session_id: uuid.UUID,
    data: QuestionnaireSubmit,
) -> dict:
    session = _get_session_or_404(session_id)
    sess_id = str(session_id)

    now = datetime.now(UTC).isoformat()
    response = {
        "id": str(uuid.uuid4()),
        "session_id": sess_id,
        "questionnaire_type": data.questionnaire_type,
        "answers": data.answers,
        "created_at": now,
    }

    session.setdefault("questionnaires", []).append(response)
    store.save_one(_session_path(sess_id), session)

    return response
