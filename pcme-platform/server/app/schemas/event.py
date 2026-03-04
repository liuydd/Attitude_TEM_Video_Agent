from pydantic import BaseModel


class EventItem(BaseModel):
    seq: int
    ts_abs: int  # absolute timestamp ms
    ts_video: float  # video currentTime in seconds
    event_type: str
    payload: dict
    source: str


class EventBatchUpload(BaseModel):
    events: list[EventItem]


class EventBatchResponse(BaseModel):
    batch_id: str
    event_count: int
    log_file_path: str
