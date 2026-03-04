from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    yield


app = FastAPI(
    title="PCME Platform",
    description="飞行学员胜任力多模态实验数据采集平台",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
from app.api.experiments import router as experiments_router  # noqa: E402
from app.api.instructor import router as instructor_router  # noqa: E402
from app.api.participants import router as participants_router  # noqa: E402
from app.api.sessions import router as sessions_router  # noqa: E402
from app.api.voice_agent import router as voice_agent_router  # noqa: E402

app.include_router(experiments_router, prefix=settings.api_prefix)
app.include_router(participants_router, prefix=settings.api_prefix)
app.include_router(sessions_router, prefix=settings.api_prefix)
app.include_router(instructor_router, prefix=settings.api_prefix)
app.include_router(voice_agent_router)  # WebSocket — no api_prefix

# Static file serving for recordings and training videos
_recordings_dir = settings.recordings_dir
_training_videos_dir = settings.data_dir / "training-videos"
_training_videos_dir.mkdir(parents=True, exist_ok=True)

app.mount("/recordings", StaticFiles(directory=str(_recordings_dir)), name="recordings")
app.mount(
    "/training-videos",
    StaticFiles(directory=str(_training_videos_dir)),
    name="training-videos",
)


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
