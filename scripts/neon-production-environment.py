"""Serialize machine worker configuration; dashboard/dev auth is never deployed."""
import json
import os
import re
settings = {key: os.environ.get(key, "") for key in
            ("WORKER_AUTH_TOKEN_SHA256", "MIGRATION_WORKER_REF", "WORKER_RELEASE_SHA")}
if not re.fullmatch(r"[a-fA-F0-9]{64}", settings["WORKER_AUTH_TOKEN_SHA256"]):
    raise SystemExit("Production worker token hash required")
if not re.fullmatch(r"[a-f0-9]{40}", settings["WORKER_RELEASE_SHA"]):
    raise SystemExit("Pinned release commit required")
if not re.fullmatch(r"production-worker-[a-zA-Z0-9.-]+", settings["MIGRATION_WORKER_REF"]):
    raise SystemExit("Expected a production-worker release tag")
with os.fdopen(os.open("/tmp/neon-production-env.json", os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600), "w") as output:
    json.dump(settings, output)
