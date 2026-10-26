"""Generates agents/gottaeat_sdk from packages/schemas/openapi.json.

Run through `pnpm openapi:python` (or `cd agents && uv run python scripts/gen_client.py`). Never hand-edit the output.
tests/test_client.py regenerates into a temp dir and fails when the committed client is stale.
"""

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

GENERATOR = "openapi-python-client==0.29.1"
AGENTS_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = AGENTS_DIR.parent
OPENAPI = REPO_ROOT / "packages" / "schemas" / "openapi.json"
CONFIG = AGENTS_DIR / "openapi-client.yaml"
PACKAGE = "gottaeat_sdk"
TARGET = AGENTS_DIR / PACKAGE


def generate(dest: Path) -> None:
    """Writes the client package to `dest` (replacing it), formatted the same way everywhere."""
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / PACKAGE
        subprocess.run(
            [
                "uvx",
                "--from",
                GENERATOR,
                "openapi-python-client",
                "generate",
                "--path",
                str(OPENAPI),
                "--meta",
                "none",
                "--config",
                str(CONFIG),
                "--output-path",
                str(out),
                "--fail-on-warning",
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        # --isolated: the same formatting whether the output sits in agents/ or a temp dir.
        subprocess.run(
            [sys.executable, "-m", "ruff", "format", "--isolated", "--line-length", "120", "--quiet", str(out)],
            check=True,
        )
        if dest.exists():
            shutil.rmtree(dest)
        shutil.copytree(out, dest)


if __name__ == "__main__":
    generate(TARGET)
    print(f"openapi:python: wrote {TARGET.relative_to(REPO_ROOT)}")
