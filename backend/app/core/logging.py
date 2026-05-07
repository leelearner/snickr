import logging
from pathlib import Path
from typing import Any

_event_logger = logging.getLogger("snickr.event")

LOG_FILE = Path(__file__).resolve().parent.parent.parent / "snickr.log"


def setup_logging() -> None:
    formatter = logging.Formatter(
        "%(asctime)s %(levelname)-5s %(name)s %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    stream = logging.StreamHandler()
    stream.setFormatter(formatter)
    file_handler = logging.FileHandler(LOG_FILE, mode="a", encoding="utf-8")
    file_handler.setFormatter(formatter)

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(stream)
    root.addHandler(file_handler)
    root.setLevel(logging.INFO)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)


def log_event(category: str, **fields: Any) -> None:
    parts = [f"{k}={_format(v)}" for k, v in fields.items()]
    _event_logger.info("%s %s", category, " ".join(parts))


def _format(value: Any) -> str:
    if value is None:
        return "-"
    if isinstance(value, str) and (" " in value or value == ""):
        return f'"{value}"'
    return str(value)
