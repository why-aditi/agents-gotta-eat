"""Settings from the environment (see .env.example, "House agents")."""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass, field

AGENT_NAMES = ("sieve", "scout", "grifter")


@dataclass(frozen=True)
class Settings:
    api_url: str = "http://localhost:3001"
    gateway_url: str = "http://localhost:4000"
    gateway_key: str = ""
    wake_secret: str = ""
    poll_seconds: int = 60
    # Agent name → API key. Agents without a key are disabled.
    agent_keys: dict[str, str] = field(default_factory=dict)
    grifter_payee_agent_id: str = ""

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None) -> Settings:
        e = os.environ if env is None else env
        keys = {name: e.get(f"{name.upper()}_API_KEY", "").strip() for name in AGENT_NAMES}
        return cls(
            api_url=e.get("GOTTAEAT_API_URL", "") or cls.api_url,
            gateway_url=e.get("GATEWAY_URL", "") or cls.gateway_url,
            gateway_key=e.get("LITELLM_MASTER_KEY", ""),
            wake_secret=e.get("AGENTS_WAKE_SECRET", ""),
            poll_seconds=int(e.get("AGENTS_POLL_SECONDS", "") or cls.poll_seconds),
            agent_keys={name: key for name, key in keys.items() if key},
            grifter_payee_agent_id=e.get("GRIFTER_PAYEE_AGENT_ID", "").strip(),
        )
