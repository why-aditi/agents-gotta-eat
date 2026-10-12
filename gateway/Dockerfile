# Official LiteLLM proxy image, pinned to a stable (non-prerelease) release.
FROM ghcr.io/berriai/litellm:v1.104.3

COPY config.yaml /app/config.yaml

# The image's ENTRYPOINT (docker/prod_entrypoint.sh) execs `litellm "$@"` but does no
# env expansion, so wrap it in a shell to read Render's $PORT (default 4000).
ENTRYPOINT ["/bin/sh", "-c", "exec docker/prod_entrypoint.sh --config /app/config.yaml --port ${PORT:-4000}"]
