from sqlalchemy.orm import Session
from sqlalchemy import select
from backend.models import Zone, Incident, MaintenanceAction
from backend.seed import seed_database


def test_persistence_across_sessions(test_engine):
    """Verify that records committed in one session persist when a new session is opened."""
    # Session 1: Create a record
    with Session(test_engine) as session1:
        new_zone = Zone(
            id="NZ-TEST-99",
            code="NZ-TEST-99",
            name="Test Persistence Zone",
            ward="Test Ward",
            risk_band="low",
            risk_score=20,
            confidence="high",
            latitude=19.05,
            longitude=73.02,
        )
        session1.add(new_zone)
        session1.commit()

    # Session 2: Read the record in a totally fresh session
    with Session(test_engine) as session2:
        saved_zone = session2.get(Zone, "NZ-TEST-99")
        assert saved_zone is not None
        assert saved_zone.name == "Test Persistence Zone"
        assert saved_zone.risk_score == 20

        # Cleanup
        session2.delete(saved_zone)
        session2.commit()


def test_seed_idempotency(test_engine):
    """Verify that running seed_database repeatedly does not duplicate data."""
    with Session(test_engine) as session:
        initial_zones = session.execute(select(Zone)).scalars().all()
        initial_count = len(initial_zones)

        # Call seed without force
        seeded = seed_database(session, force=False)
        assert seeded is False  # Should be skipped because data exists

        # Count must remain exactly the same
        current_count = len(session.execute(select(Zone)).scalars().all())
        assert current_count == initial_count
