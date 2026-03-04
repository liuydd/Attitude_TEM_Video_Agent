"""Instructor evaluation API – session browsing, annotations, CBTA scoring."""

from __future__ import annotations

import csv
import json
import uuid
from datetime import UTC, datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException

from app.config import settings
from app.schemas.evaluation import (
    AnnotationCreate,
    AnnotationResponse,
    AnnotationUpdate,
    EvaluationResponse,
    EvaluationUpdate,
    PhysioChannel,
    PhysioData,
    PhysioDataPoint,
    SessionDetailEnriched,
    SessionListItem,
)
from app.store import store

router = APIRouter(prefix="/instructor", tags=["instructor"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _eval_path(session_id: str) -> Path:
    return settings.evaluations_dir / f"{session_id}.json"


def _load_evaluation(session_id: str) -> dict | None:
    return store.load_one(_eval_path(session_id))


def _save_evaluation(session_id: str, data: dict) -> None:
    store.save_one(_eval_path(session_id), data)


def _empty_evaluation(session_id: str) -> dict:
    now = _now_iso()
    return {
        "session_id": session_id,
        "instructor_name": "",
        "created_at": now,
        "updated_at": now,
        "annotations": [],
        "dimension_scores": {},
        "overall_comment": "",
    }


def _load_experiments() -> list[dict]:
    return store.load_all(settings.metadata_dir / "experiments.json")


def _load_participants() -> list[dict]:
    return store.load_all(settings.metadata_dir / "participants.json")


def _load_session(session_id: str) -> dict | None:
    return store.load_one(settings.metadata_dir / "sessions" / f"{session_id}.json")


def _load_events(session: dict) -> list[dict]:
    """Load events from JSONL log file."""
    batches = session.get("event_batches", [])
    if not batches:
        return []
    log_path = settings.data_dir / batches[0].get("log_file_path", "")
    if not log_path.exists():
        return []
    events: list[dict] = []
    for line in log_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            events.append(json.loads(line))
    return events


def _session_duration(session: dict) -> float | None:
    started = session.get("started_at")
    ended = session.get("ended_at")
    if not started or not ended:
        return None
    try:
        fmt = "%Y-%m-%d %H:%M:%S.%f"
        t0 = datetime.strptime(str(started).replace("T", " ").split("+")[0], fmt)
        t1 = datetime.strptime(str(ended).replace("T", " ").split("+")[0], fmt)
        return (t1 - t0).total_seconds()
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Physio data loading
# ---------------------------------------------------------------------------

# Which columns to extract from each CSV type → (channel_key, label, unit)
_PHYSIO_CHANNEL_MAP: dict[str, list[tuple[str, str, str, str]]] = {
    "PPG": [
        ("HR_PPG", "hr", "Heart Rate", "bpm"),
        ("RMSSD_PPG", "rmssd", "HRV (RMSSD)", "ms"),
        ("Resp", "resp", "Respiration Rate", "/min"),
        ("LHR_P_PPG", "lf_hf", "LF/HF Ratio", ""),
    ],
    "GSR": [
        ("mean_SCL", "scl", "Skin Conductance Level", "μS"),
        ("num_SCR", "scr_count", "SCR Count", ""),
    ],
    "ACC": [
        ("totalAcc", "acc", "Body Movement", "g"),
    ],
    "GYRO": [
        ("totalGyro", "gyro", "Wrist Rotation", "°/s"),
    ],
}


def _find_physio_sync_ts(events: list[dict]) -> int | None:
    """Return the ts_abs of the first physio_sync button press event."""
    for e in events:
        if e.get("event_type") == "physio_sync":
            ts = e.get("ts_abs")
            if isinstance(ts, (int, float)) and ts > 0:
                return int(ts)
    return None


def _estimate_clock_offset(csv_path: Path, sync_computer_ts: int) -> int:
    """Scan a CSV to find the wristband timestamp closest to *sync_computer_ts*.

    Returns the clock offset ``wristband_ts - computer_ts`` (milliseconds).
    If the two clocks are perfectly synced the offset is ~0.
    """
    closest_ts: int | None = None
    min_diff = float("inf")
    try:
        with open(csv_path, encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                ts_str = (row.get("timeStamp") or "").strip()
                if not ts_str:
                    continue
                try:
                    ts_ms = int(ts_str)
                except ValueError:
                    continue
                diff = abs(ts_ms - sync_computer_ts)
                if diff < min_diff:
                    min_diff = diff
                    closest_ts = ts_ms
    except Exception:
        return 0
    if closest_ts is None:
        return 0
    return closest_ts - sync_computer_ts


def _load_physio(session: dict, events: list[dict] | None = None) -> PhysioData:
    """Load physio CSV files from session's physio data folder.

    If a ``physio_sync`` event exists in the event log, its computer-side
    timestamp is matched against the closest CSV row to compute a clock
    offset between the experiment PC and the wristband.  This corrects for
    any drift between the two clocks.
    """
    session_id = session["id"]
    physio_rel = session.get("physio_data_path")

    # Determine physio directory
    if physio_rel:
        physio_dir = settings.data_dir / physio_rel
    else:
        physio_dir = settings.physio_dir / session_id

    if not physio_dir.exists():
        return PhysioData(session_id=session_id, has_data=False)

    # Find CSV files — support both flat and nested layouts:
    #   flat:   physio_data/{session_id}/ACC.csv
    #   nested: physio_data/{session_id}/ACC/*.csv
    #   nested: physio_data/{session_id}/子目录/ACC/*.csv
    csv_files: dict[str, Path] = {}
    for sensor_type in _PHYSIO_CHANNEL_MAP:
        # Try flat
        flat = physio_dir / f"{sensor_type}.csv"
        if flat.exists():
            csv_files[sensor_type] = flat
            continue
        # Try nested: look in any subdirectory
        found = list(physio_dir.rglob(f"{sensor_type}/*.csv"))
        if not found:
            found = list(physio_dir.rglob(f"*{sensor_type}*.csv"))
        if found:
            csv_files[sensor_type] = found[0]

    if not csv_files:
        return PhysioData(session_id=session_id, has_data=False)

    anchor_ms = session.get("anchor_timestamp_ms")

    # --- Clock offset calibration via physio_sync event ---
    # The wristband clock may differ from the experiment PC clock.  When the
    # experimenter presses the "生理同步打点" button, we record the PC's
    # ts_abs.  We then find the nearest CSV row (wristband time) and compute
    # offset = wristband_ts - pc_ts.  Adjusting anchor_ms by this offset
    # maps CSV timestamps into the camera timeline correctly.
    clock_offset = 0
    sync_ts = _find_physio_sync_ts(events or [])
    if sync_ts is not None and csv_files:
        # Use the first available CSV to estimate offset (all share one clock)
        first_csv = next(iter(csv_files.values()))
        clock_offset = _estimate_clock_offset(first_csv, sync_ts)

    effective_anchor = (anchor_ms + clock_offset) if anchor_ms is not None else None

    channels: list[PhysioChannel] = []
    for sensor_type, csv_path in csv_files.items():
        channel_defs = _PHYSIO_CHANNEL_MAP[sensor_type]
        parsed = _parse_physio_csv(csv_path, channel_defs, effective_anchor)
        channels.extend(parsed)

    return PhysioData(
        session_id=session_id,
        channels=channels,
        has_data=len(channels) > 0,
    )


def _parse_physio_csv(
    csv_path: Path,
    channel_defs: list[tuple[str, str, str, str]],
    anchor_ms: int | None,
) -> list[PhysioChannel]:
    """Parse a physio CSV and extract specified columns."""
    channels_data: dict[str, list[PhysioDataPoint]] = {
        col: [] for col, _, _, _ in channel_defs
    }
    first_ts: int | None = None

    try:
        with open(csv_path, encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                ts_str = row.get("timeStamp", "").strip()
                if not ts_str:
                    continue
                try:
                    ts_ms = int(ts_str)
                except ValueError:
                    continue

                if first_ts is None:
                    first_ts = ts_ms

                # Convert to relative seconds
                if anchor_ms is not None:
                    time_s = (ts_ms - anchor_ms) / 1000.0
                else:
                    time_s = (ts_ms - first_ts) / 1000.0

                for col, _, _, _ in channel_defs:
                    val_str = row.get(col, "").strip()
                    if not val_str:
                        continue
                    try:
                        val = float(val_str)
                    except ValueError:
                        continue
                    channels_data[col].append(
                        PhysioDataPoint(time=round(time_s, 1), value=val)
                    )
    except Exception:
        return []

    result: list[PhysioChannel] = []
    for col, key, label, unit in channel_defs:
        data = channels_data[col]
        if data:
            result.append(PhysioChannel(
                key=key,
                label=label,
                unit=unit,
                source=csv_path.parent.name,
                data=data,
            ))
    return result


# ---------------------------------------------------------------------------
# Session list
# ---------------------------------------------------------------------------

@router.get("/sessions", response_model=list[SessionListItem])
async def list_sessions(
    experiment_id: str | None = None,
    status: str | None = None,
    has_evaluation: bool | None = None,
):
    experiments = _load_experiments()
    participants = _load_participants()
    exp_map = {e["id"]: e for e in experiments}
    part_map = {p["id"]: p for p in participants}

    sessions_dir = settings.metadata_dir / "sessions"
    if not sessions_dir.exists():
        return []

    items: list[SessionListItem] = []
    for f in sessions_dir.glob("*.json"):
        sess = store.load_one(f)
        if sess is None:
            continue
        sid = sess["id"]
        eid = sess.get("experiment_id", "")
        pid = sess.get("participant_id", "")

        # Filters
        if experiment_id and eid != experiment_id:
            continue
        if status and sess.get("status") != status:
            continue

        has_eval = _eval_path(sid).exists()
        if has_evaluation is not None and has_eval != has_evaluation:
            continue

        exp = exp_map.get(eid, {})
        part = part_map.get(pid, {})
        items.append(
            SessionListItem(
                id=sid,
                experiment_id=eid,
                experiment_name=exp.get("name", ""),
                participant_id=pid,
                participant_name=part.get("name", ""),
                group_type=exp.get("group_type", ""),
                status=sess.get("status", ""),
                has_evaluation=has_eval,
                duration_seconds=_session_duration(sess),
                created_at=sess.get("created_at", ""),
            )
        )
    items.sort(key=lambda x: x.created_at, reverse=True)
    return items


# ---------------------------------------------------------------------------
# Session detail
# ---------------------------------------------------------------------------

@router.get("/sessions/{session_id}", response_model=SessionDetailEnriched)
async def get_session_detail(session_id: str):
    sess = _load_session(session_id)
    if sess is None:
        raise HTTPException(404, "Session not found")

    experiments = _load_experiments()
    participants = _load_participants()
    exp = store.find_by_field(experiments, "id", sess["experiment_id"]) or {}
    part = store.find_by_field(participants, "id", sess["participant_id"]) or {}
    evaluation_data = _load_evaluation(session_id)
    evaluation = EvaluationResponse(**evaluation_data) if evaluation_data else None
    events = _load_events(sess)
    physio = _load_physio(sess, events)

    return SessionDetailEnriched(
        id=session_id,
        experiment_id=sess.get("experiment_id", ""),
        experiment_name=exp.get("name", ""),
        participant_id=sess.get("participant_id", ""),
        participant_name=part.get("name", ""),
        group_type=exp.get("group_type", ""),
        status=sess.get("status", ""),
        anchor_timestamp_ms=sess.get("anchor_timestamp_ms"),
        started_at=sess.get("started_at"),
        ended_at=sess.get("ended_at"),
        training_video_filename=(
            sess.get("training_video_filename")
            or exp.get("training_video_filename")
        ),
        recordings=sess.get("recordings", []),
        questionnaires=sess.get("questionnaires", []),
        conversation=sess.get("conversation", []),
        events=events,
        evaluation=evaluation,
        physio=physio if physio.has_data else None,
        created_at=sess.get("created_at", ""),
    )


# ---------------------------------------------------------------------------
# Evaluation CRUD
# ---------------------------------------------------------------------------

@router.get("/sessions/{session_id}/evaluation", response_model=EvaluationResponse)
async def get_evaluation(session_id: str):
    data = _load_evaluation(session_id)
    if data is None:
        raise HTTPException(404, "Evaluation not found")
    return EvaluationResponse(**data)


@router.put("/sessions/{session_id}/evaluation", response_model=EvaluationResponse)
async def upsert_evaluation(session_id: str, body: EvaluationUpdate):
    sess = _load_session(session_id)
    if sess is None:
        raise HTTPException(404, "Session not found")

    existing = _load_evaluation(session_id)
    if existing is None:
        existing = _empty_evaluation(session_id)

    existing["instructor_name"] = body.instructor_name
    existing["dimension_scores"] = {
        k.value: v.model_dump() for k, v in body.dimension_scores.items()
    }
    existing["overall_comment"] = body.overall_comment
    existing["updated_at"] = _now_iso()
    _save_evaluation(session_id, existing)
    return EvaluationResponse(**existing)


# ---------------------------------------------------------------------------
# Annotation CRUD
# ---------------------------------------------------------------------------

@router.post(
    "/sessions/{session_id}/annotations",
    response_model=AnnotationResponse,
    status_code=201,
)
async def add_annotation(session_id: str, body: AnnotationCreate):
    sess = _load_session(session_id)
    if sess is None:
        raise HTTPException(404, "Session not found")
    if body.end_time <= body.start_time:
        raise HTTPException(422, "end_time must be greater than start_time")

    existing = _load_evaluation(session_id)
    if existing is None:
        existing = _empty_evaluation(session_id)

    ann = {
        "id": str(uuid.uuid4()),
        "start_time": body.start_time,
        "end_time": body.end_time,
        "competencies": [c.value for c in body.competencies],
        "rating": body.rating,
        "comment": body.comment,
        "created_at": _now_iso(),
    }
    existing["annotations"].append(ann)
    existing["updated_at"] = _now_iso()
    _save_evaluation(session_id, existing)
    return AnnotationResponse(**ann)


@router.patch(
    "/sessions/{session_id}/annotations/{annotation_id}",
    response_model=AnnotationResponse,
)
async def update_annotation(
    session_id: str, annotation_id: str, body: AnnotationUpdate
):
    data = _load_evaluation(session_id)
    if data is None:
        raise HTTPException(404, "Evaluation not found")

    for ann in data["annotations"]:
        if ann["id"] == annotation_id:
            if body.start_time is not None:
                ann["start_time"] = body.start_time
            if body.end_time is not None:
                ann["end_time"] = body.end_time
            if body.competencies is not None:
                ann["competencies"] = [c.value for c in body.competencies]
            if body.rating is not None:
                ann["rating"] = body.rating
            if body.comment is not None:
                ann["comment"] = body.comment
            # Validate times
            if ann["end_time"] <= ann["start_time"]:
                raise HTTPException(422, "end_time must be greater than start_time")
            data["updated_at"] = _now_iso()
            _save_evaluation(session_id, data)
            return AnnotationResponse(**ann)

    raise HTTPException(404, "Annotation not found")


@router.delete(
    "/sessions/{session_id}/annotations/{annotation_id}",
    status_code=204,
)
async def delete_annotation(session_id: str, annotation_id: str):
    data = _load_evaluation(session_id)
    if data is None:
        raise HTTPException(404, "Evaluation not found")

    original_len = len(data["annotations"])
    data["annotations"] = [a for a in data["annotations"] if a["id"] != annotation_id]
    if len(data["annotations"]) == original_len:
        raise HTTPException(404, "Annotation not found")

    data["updated_at"] = _now_iso()
    _save_evaluation(session_id, data)
