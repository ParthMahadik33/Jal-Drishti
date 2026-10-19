"""
Source Registry & Ingestion Run Service for JalDrishti.
Provides thread-safe coordination, run tracking, provenance tracking, and metadata queries.
"""

from datetime import datetime, timezone, timedelta
import threading
from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import select, desc

from backend.models import (
    SourceRegistryRecord,
    IngestionRunRecord,
    GeographicFeature,
    SourceEvidenceRecord,
    CollectorHeartbeat,
    utc_now,
)

# Concurrency control for in-flight source collection runs
_COLLECTING_SOURCES_LOCK = threading.Lock()
_COLLECTING_SOURCES: set[str] = set()


def is_source_collecting(source_id: str) -> bool:
    with _COLLECTING_SOURCES_LOCK:
        return source_id in _COLLECTING_SOURCES


def acquire_source_lock(source_id: str) -> bool:
    """
    Attempts to acquire exclusive collection execution lock for the given source ID.
    Returns True if lock acquired, False if already collecting.
    """
    with _COLLECTING_SOURCES_LOCK:
        if source_id in _COLLECTING_SOURCES:
            return False
        _COLLECTING_SOURCES.add(source_id)
        return True


def release_source_lock(source_id: str) -> None:
    with _COLLECTING_SOURCES_LOCK:
        _COLLECTING_SOURCES.discard(source_id)


def get_registered_sources(db: Session) -> List[SourceRegistryRecord]:
    stmt = select(SourceRegistryRecord).order_by(SourceRegistryRecord.id)
    return list(db.execute(stmt).scalars().all())


def get_source_by_id(db: Session, source_id: str) -> Optional[SourceRegistryRecord]:
    stmt = select(SourceRegistryRecord).where(SourceRegistryRecord.id == source_id)
    return db.execute(stmt).scalar_one_or_none()


def get_source_runs(db: Session, source_id: str, limit: int = 20) -> List[IngestionRunRecord]:
    stmt = (
        select(IngestionRunRecord)
        .where(IngestionRunRecord.source_id == source_id)
        .order_by(desc(IngestionRunRecord.started_at))
        .limit(limit)
    )
    return list(db.execute(stmt).scalars().all())


def get_geographic_features(
    db: Session,
    category: Optional[str] = None,
    min_lng: Optional[float] = None,
    min_lat: Optional[float] = None,
    max_lng: Optional[float] = None,
    max_lat: Optional[float] = None,
    limit: int = 500,
) -> List[GeographicFeature]:
    stmt = select(GeographicFeature)
    if category and category.lower() != "all":
        stmt = stmt.where(GeographicFeature.category == category.lower())
    stmt = stmt.order_by(GeographicFeature.category, GeographicFeature.feature_type).limit(limit)
    return list(db.execute(stmt).scalars().all())


def get_source_evidence(db: Session, limit: int = 100) -> List[SourceEvidenceRecord]:
    stmt = select(SourceEvidenceRecord).order_by(SourceEvidenceRecord.id).limit(limit)
    return list(db.execute(stmt).scalars().all())


def get_collector_heartbeat(db: Session) -> Optional[CollectorHeartbeat]:
    stmt = select(CollectorHeartbeat).where(CollectorHeartbeat.id == 1)
    return db.execute(stmt).scalar_one_or_none()


def update_collector_heartbeat(
    db: Session,
    worker_id: str = "standalone-collector-1",
    is_running: bool = True,
    active_job: Optional[str] = None,
    next_scheduled_runs: Optional[Dict[str, Any]] = None,
    pid: Optional[int] = None,
) -> CollectorHeartbeat:
    record = get_collector_heartbeat(db)
    now = utc_now()
    if not record:
        record = CollectorHeartbeat(
            id=1,
            worker_id=worker_id,
            is_running=is_running,
            last_heartbeat_at=now,
            active_job=active_job,
            next_scheduled_runs=next_scheduled_runs or {},
            started_at=now,
            pid=pid,
        )
        db.add(record)
    else:
        record.worker_id = worker_id
        record.is_running = is_running
        record.last_heartbeat_at = now
        record.active_job = active_job
        if next_scheduled_runs is not None:
            record.next_scheduled_runs = next_scheduled_runs
        if pid is not None:
            record.pid = pid
    db.commit()
    db.refresh(record)
    return record


def start_ingestion_run(
    db: Session,
    source_id: str,
    run_metadata: Optional[Dict[str, Any]] = None,
) -> IngestionRunRecord:
    """
    Creates an in-progress IngestionRunRecord and marks source status as 'Collecting'.
    """
    now = utc_now()
    source = get_source_by_id(db, source_id)
    if source:
        source.status = "Collecting"
        source.last_attempt_at = now
        db.add(source)

    run = IngestionRunRecord(
        source_id=source_id,
        started_at=now,
        status="In Progress",
        records_retrieved=0,
        records_inserted=0,
        records_updated=0,
        records_rejected=0,
        records_unchanged=0,
        run_metadata=run_metadata or {},
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def finish_ingestion_run(
    db: Session,
    run_id: int,
    status: str,
    records_retrieved: int = 0,
    records_inserted: int = 0,
    records_updated: int = 0,
    records_rejected: int = 0,
    records_unchanged: int = 0,
    error_message: Optional[str] = None,
    last_data_timestamp: Optional[str] = None,
    run_metadata: Optional[Dict[str, Any]] = None,
    source_status_override: Optional[str] = None,
) -> IngestionRunRecord:
    """
    Finalizes an IngestionRunRecord and synchronizes aggregated metrics onto the SourceRegistryRecord.
    """
    run = db.execute(select(IngestionRunRecord).where(IngestionRunRecord.id == run_id)).scalar_one_or_none()
    if not run:
        raise ValueError(f"Ingestion run {run_id} not found.")

    now = utc_now()
    run.completed_at = now
    run.status = status
    run.records_retrieved = records_retrieved
    run.records_inserted = records_inserted
    run.records_updated = records_updated
    run.records_rejected = records_rejected
    run.records_unchanged = records_unchanged
    run.error_message = error_message
    if run_metadata:
        merged = dict(run.run_metadata or {})
        merged.update(run_metadata)
        run.run_metadata = merged

    # Update parent Source record
    source = get_source_by_id(db, run.source_id)
    if source:
        if source_status_override:
            source.status = source_status_override
            source.error_summary = error_message
        elif status in ("Success", "Partial"):
            source.status = "Active"
            source.last_success_at = now
            source.error_summary = None if status == "Success" else error_message
            if last_data_timestamp:
                source.last_data_timestamp = last_data_timestamp
        else:
            source.status = "Error"
            source.error_summary = error_message

        source.records_retrieved = records_retrieved
        source.records_inserted = records_inserted
        source.records_updated = records_updated
        source.records_rejected = records_rejected
        source.records_unchanged = records_unchanged
        db.add(source)

    db.commit()
    db.refresh(run)
    return run
