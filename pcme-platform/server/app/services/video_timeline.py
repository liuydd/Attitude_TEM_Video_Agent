"""Video timeline service — loads per-video scene descriptions for LLM context injection."""

from __future__ import annotations

import json
import logging
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)


class TimelineSegment:
    __slots__ = ("start_sec", "end_sec", "description")

    def __init__(self, start_sec: float, end_sec: float, description: str) -> None:
        self.start_sec = start_sec
        self.end_sec = end_sec
        self.description = description


class VideoTimelineService:
    """Loads a video timeline JSON and provides context for a given timestamp.

    Timeline JSON format (place in data/timelines/{video_filename}.json):
    [
        {
            "start_sec": 0,
            "end_sec": 120,
            "description": "机组正在进行起飞前检查单，机长确认各仪表读数正常"
        },
        {
            "start_sec": 120,
            "end_sec": 300,
            "description": "飞机开始滑行，副驾报告跑道能见度低于标准"
        }
    ]
    """

    def __init__(self, video_filename: str) -> None:
        self._segments: list[TimelineSegment] = []
        self._loaded = False
        self._load(video_filename)

    def _load(self, video_filename: str) -> None:
        """Load timeline from data/timelines/{video_filename}.json."""
        timeline_dir = settings.data_dir / "timelines"
        # Strip video extension, add .json
        stem = Path(video_filename).stem
        timeline_path = timeline_dir / f"{stem}.json"

        if not timeline_path.exists():
            logger.info("No timeline found at %s, context injection disabled", timeline_path)
            return

        try:
            raw = json.loads(timeline_path.read_text(encoding="utf-8"))
            for entry in raw:
                self._segments.append(
                    TimelineSegment(
                        start_sec=float(entry["start_sec"]),
                        end_sec=float(entry["end_sec"]),
                        description=str(entry["description"]),
                    )
                )
            # Sort by start time
            self._segments.sort(key=lambda s: s.start_sec)
            self._loaded = True
            logger.info("Loaded %d timeline segments for %s", len(self._segments), video_filename)
        except Exception as e:
            logger.error("Failed to load timeline %s: %s", timeline_path, e)

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    def get_context(self, video_time_sec: float) -> str | None:
        """Return a context string for the given video timestamp, or None if no match."""
        if not self._segments:
            return None

        # Find the segment containing the current time
        for seg in self._segments:
            if seg.start_sec <= video_time_sec < seg.end_sec:
                minutes = int(video_time_sec // 60)
                seconds = int(video_time_sec % 60)
                return (
                    f"[系统后台信息 - 对用户不可见] "
                    f"当前视频播放时间: {minutes}分{seconds}秒。"
                    f"剧情提示: {seg.description}"
                )

        # If past all segments, use the last one
        if video_time_sec >= self._segments[-1].start_sec:
            seg = self._segments[-1]
            minutes = int(video_time_sec // 60)
            seconds = int(video_time_sec % 60)
            return (
                f"[系统后台信息 - 对用户不可见] "
                f"当前视频播放时间: {minutes}分{seconds}秒。"
                f"剧情提示: {seg.description}"
            )

        return None
