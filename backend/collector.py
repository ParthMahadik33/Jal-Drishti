"""
JalDrishti Standalone Scheduled Collector Worker (v1).

Runs autonomous data ingestion for configured and enabled sources on schedule.
Maintains a single-instance process lock and persistent heartbeat in SQLite.

Usage:
  python -m backend.collector [--run-once] [--source SOURCE_ID] [--interval SECONDS]
"""

import argparse
from datetime import datetime, timezone, timedelta
import logging
import os
import signal
import sys
import time
from pathlib import Path
from typing import Dict, Any, Optional

_REPO_ROOT = Path(__file__).resolve().parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from backend.config import settings
from backend.database import SessionLocal, Base, engine
from backend.models import SourceRegistryRecord, utc_now
from backend.seed import seed_database
from backend.services.collector.registry_service import (
    get_registered_sources,
    update_collector_heartbeat,
)
from backend.services.collector.weather_collector import collect_weather_data
from backend.services.collector.osm_collector import collect_osm_features

LOCK_FILE_PATH = os.getenv(
    "COLLECTOR_LOCK_FILE",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "collector.lock")
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [Collector] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("jaldrishti.collector")

_SHUTDOWN_REQUESTED = False


def signal_handler(signum, frame):
    global _SHUTDOWN_REQUESTED
    sig_name = "SIGINT" if signum == signal.SIGINT else f"Signal {signum}"
    logger.info(f"Received {sig_name}. Initiating graceful shutdown...")
    _SHUTDOWN_REQUESTED = True


def is_process_running(pid: int) -> bool:
    """Checks if a process with given PID is still active on the host OS."""
    if pid <= 0:
        return False
    try:
        if os.name == "nt":
            import ctypes
            kernel32 = ctypes.windll.kernel32
            process = kernel32.OpenProcess(0x1000, False, pid)  # PROCESS_QUERY_LIMITED_INFORMATION
            if process:
                kernel32.CloseHandle(process)
                return True
            return False
        else:
            os.kill(pid, 0)
            return True
    except Exception:
        return False


def acquire_worker_lock() -> bool:
    """
    Acquires single-instance lock file. Stale locks from terminated processes are reclaimed.
    """
    current_pid = os.getpid()
    if os.path.exists(LOCK_FILE_PATH):
        try:
            with open(LOCK_FILE_PATH, "r", encoding="utf-8") as f:
                content = f.read().strip()
                if content:
                    existing_pid = int(content.split(":")[0])
                    if is_process_running(existing_pid) and existing_pid != current_pid:
                        logger.error(
                            f"Another JalDrishti collector instance is already running with PID {existing_pid}."
                        )
                        return False
                    else:
                        logger.warning(f"Reclaiming stale lock file from inactive PID {existing_pid}.")
        except Exception as e:
            logger.warning(f"Could not parse existing lock file: {e}. Overwriting.")

    try:
        with open(LOCK_FILE_PATH, "w", encoding="utf-8") as f:
            f.write(f"{current_pid}:{datetime.now(timezone.utc).isoformat()}")
        return True
    except Exception as exc:
        logger.error(f"Failed to create lock file at {LOCK_FILE_PATH}: {exc}")
        return False


def release_worker_lock():
    """Removes single-instance lock file upon clean termination."""
    try:
        if os.path.exists(LOCK_FILE_PATH):
            os.remove(LOCK_FILE_PATH)
            logger.info("Collector single-instance lock released.")
    except Exception as exc:
        logger.warning(f"Error removing lock file: {exc}")


def run_source_collection(source_id: str, force: bool = False) -> Dict[str, Any]:
    """Dispatches execution for a specific source ID within a fresh DB session."""
    with SessionLocal() as db:
        if source_id == "open-meteo":
            return collect_weather_data(db, force=force)
        elif source_id == "osm-overpass":
            return collect_osm_features(db, force=force)
        else:
            logger.info(f"Source '{source_id}' is manual/curated; no automated ingestion scheduled.")
            return {"status": "Skipped", "source_id": source_id, "reason": "No automated ingestion engine"}


def calculate_next_scheduled_runs(db) -> Dict[str, str]:
    """Computes ISO timestamps for when each enabled automated source is next due."""
    sources = get_registered_sources(db)
    schedule_map = {}
    now = utc_now()
    for s in sources:
        if not s.is_enabled or not s.collection_interval_seconds:
            continue
        if s.id not in ("open-meteo", "osm-overpass"):
            continue

        if not s.last_attempt_at:
            due = now
        else:
            last_attempt = s.last_attempt_at
            if last_attempt.tzinfo is None:
                last_attempt = last_attempt.replace(tzinfo=timezone.utc)
            due = last_attempt + timedelta(seconds=s.collection_interval_seconds)

        schedule_map[s.id] = due.isoformat()
    return schedule_map


def main():
    parser = argparse.ArgumentParser(description="JalDrishti Autonomous Source Collector Worker")
    parser.add_argument("--run-once", action="store_true", help="Run enabled collectors once immediately and exit")
    parser.add_argument("--source", type=str, default=None, help="Run only the specified source ID")
    parser.add_argument("--interval", type=int, default=5, help="Loop sleep interval in seconds (default: 5)")
    args = parser.parse_args()

    # Register OS signals
    signal.signal(signal.SIGINT, signal_handler)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, signal_handler)

    # Ensure tables and seed data exist
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_database(db, force=False)

    # Acquire lock
    if not acquire_worker_lock():
        sys.exit(1)

    pid = os.getpid()
    logger.info(f"JalDrishti Collector started successfully (PID: {pid}).")
    logger.info("Notice: Autonomous collection continues only while this worker process is running.")

    try:
        # Initial heartbeat
        with SessionLocal() as db:
            next_runs = calculate_next_scheduled_runs(db)
            update_collector_heartbeat(
                db,
                worker_id=f"collector-{pid}",
                is_running=True,
                active_job=None,
                next_scheduled_runs=next_runs,
                pid=pid,
            )

        if args.run_once:
            logger.info("Running in single-execution mode (--run-once)...")
            sources_to_run = [args.source] if args.source else ["open-meteo", "osm-overpass"]
            for sid in sources_to_run:
                if _SHUTDOWN_REQUESTED:
                    break
                logger.info(f"Executing collection for '{sid}'...")
                with SessionLocal() as db:
                    update_collector_heartbeat(db, is_running=True, active_job=sid, pid=pid)
                res = run_source_collection(sid, force=True)
                logger.info(f"Result for '{sid}': {res.get('status')} (records: {res.get('records_retrieved', 0)})")

            with SessionLocal() as db:
                next_runs = calculate_next_scheduled_runs(db)
                update_collector_heartbeat(db, is_running=False, active_job=None, next_scheduled_runs=next_runs, pid=pid)
            logger.info("Single-execution run complete. Exiting.")
            return

        # Main polling daemon loop
        logger.info("Entering continuous polling daemon loop...")
        last_heartbeat_time = 0.0

        while not _SHUTDOWN_REQUESTED:
            loop_now = time.time()
            now_dt = utc_now()

            # Refresh heartbeat periodically (every 10s)
            if loop_now - last_heartbeat_time >= 10.0:
                with SessionLocal() as db:
                    next_runs = calculate_next_scheduled_runs(db)
                    update_collector_heartbeat(
                        db,
                        worker_id=f"collector-{pid}",
                        is_running=True,
                        active_job=None,
                        next_scheduled_runs=next_runs,
                        pid=pid,
                    )
                last_heartbeat_time = loop_now

            # Evaluate scheduled sources
            with SessionLocal() as db:
                sources = get_registered_sources(db)
                due_sources = []
                for s in sources:
                    if not s.is_enabled or not s.collection_interval_seconds:
                        continue
                    if s.id not in ("open-meteo", "osm-overpass"):
                        continue
                    if args.source and s.id != args.source:
                        continue

                    # Check if due
                    if not s.last_attempt_at:
                        due_sources.append(s.id)
                    else:
                        last_att = s.last_attempt_at
                        if last_att.tzinfo is None:
                            last_att = last_att.replace(tzinfo=timezone.utc)
                        interval_td = timedelta(seconds=s.collection_interval_seconds)
                        if now_dt >= (last_att + interval_td):
                            due_sources.append(s.id)

            for sid in due_sources:
                if _SHUTDOWN_REQUESTED:
                    break
                logger.info(f"Scheduled interval reached for source '{sid}'. Collecting...")
                with SessionLocal() as db:
                    update_collector_heartbeat(db, is_running=True, active_job=sid, pid=pid)

                try:
                    outcome = run_source_collection(sid, force=False)
                    logger.info(f"Collection finished for '{sid}': {outcome.get('status')} - retrieved: {outcome.get('records_retrieved', 0)}")
                except Exception as exc:
                    logger.error(f"Unhandled error collecting source '{sid}': {exc}")

                with SessionLocal() as db:
                    next_runs = calculate_next_scheduled_runs(db)
                    update_collector_heartbeat(db, is_running=True, active_job=None, next_scheduled_runs=next_runs, pid=pid)

            # Sleep short interval
            time.sleep(args.interval)

    finally:
        logger.info("Shutting down collector worker...")
        try:
            with SessionLocal() as db:
                update_collector_heartbeat(
                    db,
                    worker_id=f"collector-{pid}",
                    is_running=False,
                    active_job=None,
                    pid=pid,
                )
        except Exception as e:
            logger.warning(f"Error finalizing worker heartbeat: {e}")
        release_worker_lock()
        logger.info("Worker process ended cleanly.")


if __name__ == "__main__":
    main()
