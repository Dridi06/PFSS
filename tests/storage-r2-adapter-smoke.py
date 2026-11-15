import importlib.util
from pathlib import Path
import tempfile
from types import SimpleNamespace

spec = importlib.util.spec_from_file_location("storage_r2_adapter", Path(__file__).parents[1] / "scripts/storage_r2_adapter.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

calls = []
def runner(args, env):
    calls.append((args, dict(env)))
    if "head-object" in args and sum(1 for old, _ in calls if "head-object" in old) <= 2:
        return SimpleNamespace(returncode=1, not_found=True)
    return SimpleNamespace(returncode=0)

with tempfile.TemporaryDirectory() as tmp:
    root = Path(tmp)
    encrypted = root / "pfms-storage-20261115T090000Z-abc123.tar.enc"
    encrypted.write_bytes(b"ciphertext")
    Path(str(encrypted) + ".hmac").write_text("authenticated manifest")
    result = mod.upload_encrypted_pair(endpoint="https://account.r2.cloudflarestorage.com",
        bucket="pfms-backups", access_key="access-secret", secret_key="secret-secret",
        encrypted_file=encrypted, runner=runner)
    assert result["key"] == "storage/daily/" + encrypted.name
    assert len(calls) == 6  # two preflight HEAD, two uploads, two post-upload HEAD
    assert all("access-secret" not in " ".join(args) and "secret-secret" not in " ".join(args) for args, _ in calls)
    assert all(env["AWS_EC2_METADATA_DISABLED"] == "true" for _, env in calls)
    assert all("--acl" not in args for args, _ in calls)

    calls.clear()
    def collision_runner(args, env):
        calls.append(args)
        return SimpleNamespace(returncode=0 if "head-object" in args else 1)

    try:
        mod.upload_encrypted_pair(endpoint="https://account.r2.cloudflarestorage.com",
            bucket="pfms-backups", access_key="a", secret_key="b",
            encrypted_file=encrypted, runner=collision_runner)
        raise AssertionError("existing key must be rejected")
    except mod.R2TransportError:
        pass
    assert len(calls) == 1

for endpoint in ("http://account.r2.cloudflarestorage.com", "https://user:pass@account.r2.cloudflarestorage.com",
                 "https://account.r2.cloudflarestorage.com/path", "https://account.r2.cloudflarestorage.com/?x=1"):
    try:
        mod._config(endpoint, "pfms-backups", "a", "b")
        raise AssertionError("unsafe endpoint accepted")
    except mod.R2TransportError:
        pass
for filename in ("../../database.dump", "pfms-storage-latest.tar.enc", "backup.tar.enc"):
    try:
        mod._key(filename)
        raise AssertionError("unsafe key accepted")
    except mod.R2TransportError:
        pass
print("Storage R2 adapter smoke tests passed (fake runner; no network).")
