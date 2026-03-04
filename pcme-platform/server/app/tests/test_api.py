import pytest
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.main import app


@pytest.fixture(autouse=True)
def use_tmp_data_dir(tmp_path, monkeypatch):
    """Redirect all data directories to a temporary directory for test isolation."""
    monkeypatch.setattr(settings, "data_dir", tmp_path)
    monkeypatch.setattr(settings, "metadata_dir", tmp_path / "metadata")
    monkeypatch.setattr(settings, "recordings_dir", tmp_path / "recordings")
    monkeypatch.setattr(settings, "logs_dir", tmp_path / "logs")
    monkeypatch.setattr(settings, "exports_dir", tmp_path / "exports")
    monkeypatch.setattr(settings, "evaluations_dir", tmp_path / "metadata" / "evaluations")
    monkeypatch.setattr(settings, "physio_dir", tmp_path / "physio_data")
    # Ensure directories exist
    for d in [
        tmp_path / "metadata",
        tmp_path / "metadata" / "sessions",
        tmp_path / "metadata" / "evaluations",
        tmp_path / "recordings",
        tmp_path / "logs",
        tmp_path / "exports",
        tmp_path / "physio_data",
    ]:
        d.mkdir(parents=True, exist_ok=True)


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def test_health(client: AsyncClient):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


async def test_create_experiment(client: AsyncClient):
    resp = await client.post(
        "/api/experiments",
        json={
            "name": "Test Experiment",
            "group_type": "control",
            "training_video_filename": "test.mp4",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Test Experiment"
    assert data["group_type"] == "control"
    assert "id" in data


async def test_list_experiments(client: AsyncClient):
    # Create two experiments
    await client.post(
        "/api/experiments",
        json={
            "name": "Exp 1",
            "group_type": "control",
            "training_video_filename": "a.mp4",
        },
    )
    await client.post(
        "/api/experiments",
        json={
            "name": "Exp 2",
            "group_type": "experimental",
            "training_video_filename": "b.mp4",
        },
    )

    resp = await client.get("/api/experiments")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2


async def test_create_participant(client: AsyncClient):
    resp = await client.post(
        "/api/participants",
        json={"student_id": "S001", "name": "张三"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["student_id"] == "S001"


async def test_duplicate_participant(client: AsyncClient):
    await client.post(
        "/api/participants",
        json={"student_id": "S001", "name": "张三"},
    )
    resp = await client.post(
        "/api/participants",
        json={"student_id": "S001", "name": "李四"},
    )
    assert resp.status_code == 409


async def test_session_lifecycle(client: AsyncClient):
    # Create experiment
    exp_resp = await client.post(
        "/api/experiments",
        json={
            "name": "Session Test",
            "group_type": "control",
            "training_video_filename": "test.mp4",
        },
    )
    exp_id = exp_resp.json()["id"]

    # Create participant
    part_resp = await client.post(
        "/api/participants",
        json={"student_id": "S002", "name": "王五"},
    )
    part_id = part_resp.json()["id"]

    # Create session
    sess_resp = await client.post(
        "/api/sessions",
        json={"experiment_id": exp_id, "participant_id": part_id},
    )
    assert sess_resp.status_code == 201
    sess_id = sess_resp.json()["id"]
    assert sess_resp.json()["status"] == "created"
    assert sess_resp.json()["training_video_filename"] == "test.mp4"

    # Update session
    patch_resp = await client.patch(
        f"/api/sessions/{sess_id}",
        json={"status": "recording", "anchor_timestamp_ms": 1700000000000},
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["status"] == "recording"
    assert patch_resp.json()["anchor_timestamp_ms"] == 1700000000000

    # Get session
    get_resp = await client.get(f"/api/sessions/{sess_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == sess_id


async def test_upload_events(client: AsyncClient):
    # Setup
    exp_resp = await client.post(
        "/api/experiments",
        json={
            "name": "Event Test",
            "group_type": "control",
            "training_video_filename": "test.mp4",
        },
    )
    part_resp = await client.post(
        "/api/participants",
        json={"student_id": "S003", "name": "赵六"},
    )
    sess_resp = await client.post(
        "/api/sessions",
        json={
            "experiment_id": exp_resp.json()["id"],
            "participant_id": part_resp.json()["id"],
        },
    )
    sess_id = sess_resp.json()["id"]

    # Upload events
    resp = await client.post(
        f"/api/sessions/{sess_id}/events",
        json={
            "events": [
                {
                    "seq": 1,
                    "ts_abs": 1700000000123,
                    "ts_video": 45.678,
                    "event_type": "video_state_change",
                    "payload": {"state": "playing"},
                    "source": "video_player",
                },
                {
                    "seq": 2,
                    "ts_abs": 1700000001000,
                    "ts_video": 46.5,
                    "event_type": "physio_sync",
                    "payload": {"action": "button_press"},
                    "source": "physio_sync",
                },
            ]
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["event_count"] == 2


async def test_submit_questionnaire(client: AsyncClient):
    # Setup
    exp_resp = await client.post(
        "/api/experiments",
        json={
            "name": "Q Test",
            "group_type": "control",
            "training_video_filename": "test.mp4",
        },
    )
    part_resp = await client.post(
        "/api/participants",
        json={"student_id": "S004", "name": "钱七"},
    )
    sess_resp = await client.post(
        "/api/sessions",
        json={
            "experiment_id": exp_resp.json()["id"],
            "participant_id": part_resp.json()["id"],
        },
    )
    sess_id = sess_resp.json()["id"]

    # Submit questionnaire
    resp = await client.post(
        f"/api/sessions/{sess_id}/questionnaires",
        json={
            "questionnaire_type": "nasa_tlx",
            "answers": {
                "mental_demand": 75,
                "physical_demand": 30,
                "temporal_demand": 60,
                "performance": 80,
                "effort": 65,
                "frustration": 40,
            },
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["questionnaire_type"] == "nasa_tlx"
    assert data["answers"]["mental_demand"] == 75
