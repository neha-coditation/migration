"""Write development Function environment without printing credential values."""
import json
import os
import re

settings = {"DEV_AUTH_TOKEN_SHA256": os.environ["DEV_TOKEN_HASH"],
            "DEV_AUTH_SUBJECT": os.environ["DEV_SUBJECT"]}
worker_keys = ("WORKER_AUTH_TOKEN_SHA256", "MIGRATION_WORKER_REF")
if any(os.environ.get(key) for key in worker_keys):
    if not all(os.environ.get(key) for key in worker_keys):
        raise SystemExit("All development worker settings are required together")
    digest = os.environ["WORKER_AUTH_TOKEN_SHA256"]
    if not re.fullmatch(r"[a-fA-F0-9]{64}", digest) or digest.lower() == settings["DEV_AUTH_TOKEN_SHA256"].lower():
        raise SystemExit("Configure a distinct worker token hash")
    settings.update({key: os.environ[key] for key in worker_keys})
    if os.environ.get("GITHUB_WORKER_TOKEN"):
        settings["GITHUB_WORKER_TOKEN"] = os.environ["GITHUB_WORKER_TOKEN"]
    settings["MIGRATION_WORKER_REPOSITORY"] = "neha-coditation/migration"
with os.fdopen(os.open("/tmp/neon-dev-env.json", os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600), "w") as output:
    json.dump(settings, output)
