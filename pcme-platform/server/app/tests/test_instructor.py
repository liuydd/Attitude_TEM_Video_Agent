"""Tests for the instructor evaluation API."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.main import app


@pytest.fixture(autouse=True)
def use_tmp_data_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "data_dir", tmp_path)
    monkeypatch.setattr(settings, "metadata_dir", tmp_path / "metadata")
    monkeypatch.setattr(settings, "recordings_dir", tmp_path / "recordings")
    monkeypatch.setattr(settings, "logs_dir", tmp_path / "logs")
    monkeypatch.setattr(settings, "exports_dir", tmp_path / "exports")
    monkeypatch.setattr(settings, "evaluations_dir", tmp_path / "metadata" / "evaluations")
    monkeypatch.setattr(settings, "physio_dir", tmp_path / "physio_data")
    for d in [
        tmp_path / "metadata",
        tmp_path / "metadata" / "sessions",
        tmp_path / "metadata" / "evaluations",
        tmp_path / "recordings",
        tmp_path / "logs",
        tmp_path / "exports",
        tmp_path / "training-videos",
        tmp_path / "physio_data",
    ]:
        d.mkdir(parents=True, exist_ok=True)


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def _create_session(client: AsyncClient) -> str:
    """Helper: create experiment + participant + session, return session_id."""
    exp = await client.post(
        "/api/experiments",
        json={
            "name": "Eval Test Exp",
            "group_type": "experimental",
            "training_video_filename": "test.mp4",
        },
    )
    part = await client.post(
        "/api/participants",
        json={"student_id": f"S{id(client)}", "name": "测试学员"},
    )
    sess = await client.post(
        "/api/sessions",
        json={
            "experiment_id": exp.json()["id"],
            "participant_id": part.json()["id"],
        },
    )
    return sess.json()["id"]


# ---------------------------------------------------------------------------
# Session list
# ---------------------------------------------------------------------------


async def test_session_list_empty(client: AsyncClient):
    resp = await client.get("/api/instructor/sessions")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_session_list_with_data(client: AsyncClient):
    sid = await _create_session(client)
    resp = await client.get("/api/instructor/sessions")
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["id"] == sid
    assert items[0]["experiment_name"] == "Eval Test Exp"
    assert items[0]["has_evaluation"] is False


async def test_session_list_filter_has_evaluation(client: AsyncClient):
    sid = await _create_session(client)
    # No evaluation yet
    resp = await client.get("/api/instructor/sessions?has_evaluation=true")
    assert resp.json() == []

    # Create evaluation
    await client.put(
        f"/api/instructor/sessions/{sid}/evaluation",
        json={"instructor_name": "张教员"},
    )
    resp = await client.get("/api/instructor/sessions?has_evaluation=true")
    assert len(resp.json()) == 1


# ---------------------------------------------------------------------------
# Session detail
# ---------------------------------------------------------------------------


async def test_session_detail(client: AsyncClient):
    sid = await _create_session(client)
    resp = await client.get(f"/api/instructor/sessions/{sid}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == sid
    assert data["experiment_name"] == "Eval Test Exp"
    assert data["evaluation"] is None


async def test_session_detail_not_found(client: AsyncClient):
    resp = await client.get("/api/instructor/sessions/nonexistent")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Evaluation CRUD
# ---------------------------------------------------------------------------


async def test_evaluation_not_found(client: AsyncClient):
    sid = await _create_session(client)
    resp = await client.get(f"/api/instructor/sessions/{sid}/evaluation")
    assert resp.status_code == 404


async def test_create_evaluation(client: AsyncClient):
    sid = await _create_session(client)
    resp = await client.put(
        f"/api/instructor/sessions/{sid}/evaluation",
        json={
            "instructor_name": "张教员",
            "dimension_scores": {
                "communication": {"score": 4, "comment": "沟通良好"},
                "situation_awareness": {"score": 3, "comment": ""},
            },
            "overall_comment": "整体表现不错",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["instructor_name"] == "张教员"
    assert data["dimension_scores"]["communication"]["score"] == 4
    assert data["overall_comment"] == "整体表现不错"


async def test_update_evaluation(client: AsyncClient):
    sid = await _create_session(client)
    await client.put(
        f"/api/instructor/sessions/{sid}/evaluation",
        json={"instructor_name": "张教员", "overall_comment": "v1"},
    )
    resp = await client.put(
        f"/api/instructor/sessions/{sid}/evaluation",
        json={"instructor_name": "李教员", "overall_comment": "v2"},
    )
    data = resp.json()
    assert data["instructor_name"] == "李教员"
    assert data["overall_comment"] == "v2"


# ---------------------------------------------------------------------------
# Annotation CRUD
# ---------------------------------------------------------------------------


async def test_add_annotation(client: AsyncClient):
    sid = await _create_session(client)
    resp = await client.post(
        f"/api/instructor/sessions/{sid}/annotations",
        json={
            "start_time": 10.0,
            "end_time": 25.0,
            "competencies": ["communication", "situation_awareness"],
            "rating": 4,
            "comment": "表现良好",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["start_time"] == 10.0
    assert data["end_time"] == 25.0
    assert "communication" in data["competencies"]
    assert data["rating"] == 4


async def test_annotation_invalid_time(client: AsyncClient):
    sid = await _create_session(client)
    resp = await client.post(
        f"/api/instructor/sessions/{sid}/annotations",
        json={
            "start_time": 30.0,
            "end_time": 10.0,
            "competencies": ["communication"],
            "rating": 3,
        },
    )
    assert resp.status_code == 422


async def test_update_annotation(client: AsyncClient):
    sid = await _create_session(client)
    create_resp = await client.post(
        f"/api/instructor/sessions/{sid}/annotations",
        json={
            "start_time": 10.0,
            "end_time": 25.0,
            "competencies": ["communication"],
            "rating": 3,
        },
    )
    ann_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/api/instructor/sessions/{sid}/annotations/{ann_id}",
        json={"rating": 5, "comment": "更新后"},
    )
    assert resp.status_code == 200
    assert resp.json()["rating"] == 5
    assert resp.json()["comment"] == "更新后"


async def test_delete_annotation(client: AsyncClient):
    sid = await _create_session(client)
    create_resp = await client.post(
        f"/api/instructor/sessions/{sid}/annotations",
        json={
            "start_time": 10.0,
            "end_time": 25.0,
            "competencies": ["communication"],
            "rating": 3,
        },
    )
    ann_id = create_resp.json()["id"]

    resp = await client.delete(
        f"/api/instructor/sessions/{sid}/annotations/{ann_id}"
    )
    assert resp.status_code == 204

    # Verify deleted
    eval_resp = await client.get(f"/api/instructor/sessions/{sid}/evaluation")
    assert len(eval_resp.json()["annotations"]) == 0


async def test_delete_annotation_not_found(client: AsyncClient):
    sid = await _create_session(client)
    # Create evaluation first
    await client.put(
        f"/api/instructor/sessions/{sid}/evaluation",
        json={"instructor_name": "张教员"},
    )
    resp = await client.delete(
        f"/api/instructor/sessions/{sid}/annotations/nonexistent"
    )
    assert resp.status_code == 404


async def test_annotation_rating_range(client: AsyncClient):
    sid = await _create_session(client)
    # rating too high
    resp = await client.post(
        f"/api/instructor/sessions/{sid}/annotations",
        json={
            "start_time": 10.0,
            "end_time": 25.0,
            "competencies": ["communication"],
            "rating": 6,
        },
    )
    assert resp.status_code == 422

    # rating too low
    resp = await client.post(
        f"/api/instructor/sessions/{sid}/annotations",
        json={
            "start_time": 10.0,
            "end_time": 25.0,
            "competencies": ["communication"],
            "rating": 0,
        },
    )
    assert resp.status_code == 422
