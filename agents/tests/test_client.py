"""The generated client: it imports, and it matches packages/schemas/openapi.json."""

import filecmp
from pathlib import Path

from scripts.gen_client import TARGET, generate


def test_generated_client_imports() -> None:
    from gottaeat_sdk import AuthenticatedClient
    from gottaeat_sdk.api.bounties import get_v1_bounties
    from gottaeat_sdk.api.entries import post_v1_bounties_id_entries, post_v1_entries_id_submissions
    from gottaeat_sdk.api.spend import post_v1_spend_requests

    assert AuthenticatedClient(base_url="http://x", token="t")
    assert callable(get_v1_bounties.asyncio_detailed)
    assert callable(post_v1_bounties_id_entries.asyncio_detailed)
    assert callable(post_v1_entries_id_submissions.asyncio_detailed)
    assert callable(post_v1_spend_requests.asyncio_detailed)


def _text(p: Path) -> bytes:
    return p.read_bytes().replace(b"\r\n", b"\n")


def _diff(a: Path, b: Path) -> list[str]:
    cmp = filecmp.dircmp(a, b, ignore=["__pycache__"])
    out = [str(a / n) for n in cmp.left_only] + [str(b / n) for n in cmp.right_only]
    # ponytail: ignore CRLF; the generator writes it on Windows, the repo stores LF
    out += [str(a / n) for n in cmp.common_files if _text(a / n) != _text(b / n)]
    for sub in cmp.common_dirs:
        out += _diff(a / sub, b / sub)
    return out


def test_generated_client_is_current(tmp_path: Path) -> None:
    fresh = tmp_path / "gottaeat_sdk"
    generate(fresh)
    stale = _diff(TARGET, fresh)
    assert not stale, f"agents/gottaeat_sdk is stale; run `pnpm openapi:python`. Differs: {stale[:10]}"
