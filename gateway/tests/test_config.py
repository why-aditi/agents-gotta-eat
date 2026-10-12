from pathlib import Path
from typing import Any

import yaml

CONFIG: dict[str, Any] = yaml.safe_load((Path(__file__).parent.parent / "config.yaml").read_text())


def _models() -> dict[str, str]:
    return {m["model_name"]: m["litellm_params"]["model"] for m in CONFIG["model_list"]}


def test_three_providers() -> None:
    models = _models()
    assert models["primary"].startswith("gemini/")
    assert models["groq"].startswith("groq/")
    assert models["openrouter"].startswith("openrouter/")


def test_fallback_order() -> None:
    assert CONFIG["router_settings"]["fallbacks"] == [{"primary": ["groq", "openrouter"]}]


def test_no_literal_secrets() -> None:
    keys = [m["litellm_params"]["api_key"] for m in CONFIG["model_list"]]
    keys.append(CONFIG["general_settings"]["master_key"])
    assert len(keys) == 4
    assert all(k.startswith("os.environ/") for k in keys)


def test_cache_enabled() -> None:
    assert CONFIG["litellm_settings"]["cache"] is True
    assert CONFIG["litellm_settings"]["cache_params"]["type"] == "local"
