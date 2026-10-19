import os
import tempfile
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from backend.database import Base
from backend.app import create_app
from backend.seed import seed_database


class CallableJson(dict):
    def __call__(self):
        return self


class CallableJsonList(list):
    def __call__(self):
        return self


@pytest.fixture(scope="session")
def test_db_path():
    """Create a temporary SQLite database file for testing."""
    fd, path = tempfile.mkstemp(suffix=".db", prefix="jaldrishti_test_")
    os.close(fd)
    yield path
    if os.path.exists(path):
        try:
            os.remove(path)
        except Exception:
            pass


@pytest.fixture(scope="session")
def test_engine(test_db_path):
    """Create test engine connected to the temporary SQLite database."""
    engine = create_engine(
        f"sqlite:///{test_db_path}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(bind=engine)
    with Session(engine) as session:
        seed_database(session, force=True)
    yield engine
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture
def db_session(test_engine):
    """Provide a transactional database session for each test function."""
    connection = test_engine.connect()
    transaction = connection.begin()
    session = sessionmaker(bind=connection, autocommit=False, autoflush=False)()

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(test_engine):
    """Flask test client connected to the isolated temporary test database."""
    TestingSessionLocal = sessionmaker(
        bind=test_engine,
        autocommit=False,
        autoflush=False,
    )

    test_app = create_app({
        "TESTING": True,
        "SKIP_DB_INIT": True,
        "DATABASE_ENGINE": test_engine,
        "SESSION_FACTORY": TestingSessionLocal,
    })

    class TestResponse(test_app.response_class):
        @property
        def json(self):
            val = self.get_json()
            if isinstance(val, dict):
                return CallableJson(val)
            elif isinstance(val, list):
                return CallableJsonList(val)
            return val

    test_app.response_class = TestResponse

    with test_app.test_client() as test_client:
        yield test_client
