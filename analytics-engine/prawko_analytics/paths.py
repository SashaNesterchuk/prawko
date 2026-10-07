"""Filesystem locations for the analytics engine."""

from pathlib import Path

PACKAGE_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = PACKAGE_ROOT.parent
CONTRACT_PATH = PACKAGE_ROOT / "contract" / "analytics_contract.yaml"
DEFAULT_WAREHOUSE = PACKAGE_ROOT / "warehouse"
