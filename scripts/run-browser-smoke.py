import os
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path


PORT = 3000


def port_is_open() -> bool:
    try:
        with socket.create_connection(("127.0.0.1", PORT), timeout=0.5):
            return True
    except OSError:
        return False


if port_is_open():
    raise RuntimeError(f"Port {PORT} is already in use; refusing to stop an unknown process")

with tempfile.TemporaryDirectory(prefix="personal-tasks-browser-") as temporary_directory:
    environment = dict(os.environ)
    environment.update(
        {
            "HOST": "127.0.0.1",
            "PORT": str(PORT),
            "TASK_DB_PATH": str(Path(temporary_directory) / "browser.sqlite"),
        }
    )
    server = subprocess.Popen(["node", "dist/server/index.js"], env=environment)
    try:
        deadline = time.monotonic() + 30
        while not port_is_open():
            if server.poll() is not None:
                raise RuntimeError(f"Server stopped with exit code {server.returncode}")
            if time.monotonic() >= deadline:
                raise TimeoutError(f"Server did not open port {PORT} within 30 seconds")
            time.sleep(0.25)

        result = subprocess.run(
            [sys.executable, "scripts/browser-smoke.py"],
            check=False,
            env=environment,
        )
        raise SystemExit(result.returncode)
    finally:
        if server.poll() is None:
            server.terminate()
            try:
                server.wait(timeout=5)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait()
