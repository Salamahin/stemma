"""Verify that the Lambda entrypoint never activates AllowAnyTokenVerifier via E2E_AUTH_BYPASS."""

import pytest

from stemma.apps.auth import AllowAnyTokenVerifier, GoogleTokenVerifier
from stemma.apps.rest_main import build_verifier


def test_build_verifier_returns_google_verifier_by_default(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("E2E_AUTH_BYPASS", raising=False)
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "fake-client-id.apps.googleusercontent.com")
    verifier = build_verifier()
    assert isinstance(verifier, GoogleTokenVerifier)
    assert not isinstance(verifier, AllowAnyTokenVerifier)


def test_build_verifier_bypass_only_active_in_rest_not_lambda(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """lambda_main._build hardcodes GoogleTokenVerifier and never reads E2E_AUTH_BYPASS."""
    import inspect

    import stemma.apps.lambda_main as lm

    source = inspect.getsource(lm._build)
    assert "AllowAnyTokenVerifier" not in source
    assert "E2E_AUTH_BYPASS" not in source
    assert "GoogleTokenVerifier" in source
