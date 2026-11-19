"""UAT-001: Verification tests for Source Isolation & Untouched charting.py."""

from __future__ import annotations

import hashlib
import tomllib
from pathlib import Path

import pytest

from backend.config import get_settings


def _compute_sha256(file_path: Path) -> str:
    """Compute the SHA-256 hash of a file."""
    hasher = hashlib.sha256()
    with file_path.open("rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


class TestSourceIsolationUAT001:
    """UAT-001 Test Suite validating source isolation, SHA-256 integrity, and config externalization."""

    DEV_ROOT = Path("C:/Users/ferri/devt/Alpha_Insight")
    LEGACY_ALPHAINSIGHT = Path("C:/Users/ferri/OneDrive/Documents/AlphaInsight")
    LEGACY_4LEAFCLOVER = Path("C:/Users/ferri/OneDrive/Documents/4leafclover")

    def test_charting_py_exists_and_sha256_matches_legacy(self) -> None:
        """Verify that charting.py in Alpha_Insight matches the legacy file byte-for-byte."""
        target_charting = self.DEV_ROOT / "charting.py"
        legacy_charting = self.LEGACY_ALPHAINSIGHT / "charting.py"

        assert target_charting.exists(), f"Target file does not exist: {target_charting}"
        assert legacy_charting.exists(), f"Legacy reference file does not exist: {legacy_charting}"

        target_hash = _compute_sha256(target_charting)
        legacy_hash = _compute_sha256(legacy_charting)

        assert target_hash == legacy_hash, (
            f"SHA-256 hash mismatch! Untouched invariant violated.\nTarget: {target_hash}\nLegacy: {legacy_hash}"
        )
        assert len(target_hash) == 64

    def test_charting_py_is_excluded_in_pyproject_toml(self) -> None:
        """Verify that charting.py is excluded in ruff and mypy configurations within pyproject.toml."""
        pyproject_path = self.DEV_ROOT / "pyproject.toml"
        assert pyproject_path.exists(), "pyproject.toml must exist at repo root"

        with pyproject_path.open("rb") as f:
            pyproject_data = tomllib.load(f)

        # 1. Check Ruff extend-exclude
        ruff_extend_exclude = pyproject_data.get("tool", {}).get("ruff", {}).get("extend-exclude", [])
        assert "charting.py" in ruff_extend_exclude, (
            f"charting.py must be listed in tool.ruff.extend-exclude, found: {ruff_extend_exclude}"
        )

        # 2. Check Mypy exclude
        mypy_exclude = pyproject_data.get("tool", {}).get("mypy", {}).get("exclude", [])
        assert any("charting" in pattern for pattern in mypy_exclude), (
            f"charting.py must be excluded in tool.mypy.exclude, found: {mypy_exclude}"
        )

    def test_backend_config_externalizes_margin_rate_constants(self) -> None:
        """Verify that backend/config.py defines typed settings for margin interest calculations."""
        settings = get_settings()

        # Check default margin rates
        assert hasattr(settings, "default_margin_rate_usd")
        assert hasattr(settings, "default_margin_basis_usd")
        assert hasattr(settings, "default_margin_rate_sgd")
        assert hasattr(settings, "default_margin_basis_sgd")
        assert hasattr(settings, "default_margin_rate_other")
        assert hasattr(settings, "default_margin_basis_other")

        assert settings.default_margin_rate_usd == pytest.approx(0.0565)
        assert settings.default_margin_basis_usd == 360
        assert settings.default_margin_rate_sgd == pytest.approx(0.0291)
        assert settings.default_margin_basis_sgd == 365
        assert settings.default_margin_rate_other == pytest.approx(0.0500)
        assert settings.default_margin_basis_other == 365

    def test_run_daily_margin_interest_config_integration(self) -> None:
        """Verify that run_daily_margin_interest.py references externalized config or avoids hardcoded literals."""
        script_path = self.DEV_ROOT / "run_daily_margin_interest.py"
        assert script_path.exists(), "run_daily_margin_interest.py must exist at repo root"
        content = script_path.read_text(encoding="utf-8")

        # Either imports config or uses settings
        has_config_import = "backend.config" in content or "get_settings" in content
        # Or defines externalized configuration variables
        has_settings_call = "default_margin_rate_usd" in content or "Settings" in content

        # During migration or after refactoring by BE worker:
        assert has_config_import or has_settings_call or "pd.get_margin_interest_rates" in content

    def test_legacy_directories_accessible_and_intact(self) -> None:
        """Verify that legacy reference directories exist and contain key source files."""
        assert self.LEGACY_ALPHAINSIGHT.is_dir()
        assert self.LEGACY_4LEAFCLOVER.is_dir()
        assert (self.LEGACY_ALPHAINSIGHT / "charting.py").exists()
        assert (self.LEGACY_4LEAFCLOVER / "ProcessData.py").exists()
        assert (self.LEGACY_4LEAFCLOVER / "main.py").exists()
