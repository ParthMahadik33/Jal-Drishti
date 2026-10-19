"""
JalDrishti Flask Application Entrypoint
Provides backward-compatible export of create_app and app from backend.app.
"""
import sys
from pathlib import Path

# Ensure project root is in sys.path so 'backend' package imports work
_REPO_ROOT = Path(__file__).resolve().parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from backend.app import create_app, app
from backend.config import settings

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8000, debug=settings.DEBUG)
