"""Live local HTTP verification. Uses paid models; runtime enforces the $2 ledger."""

import json, time, sys
from pathlib import Path
from uuid import uuid4
import httpx

BASE = "http://127.0.0.1:4112"
H = {
    "x-tenant-id": "00000000-0000-7000-8000-000000000003",
    "origin": "http://localhost:3012",
}
OUT = Path("../morning-brew-platform-sprint-1oct-v2/artifacts/conference")
FIX = Path("apps/web/public/demo-documents/ada")
inv = json.loads((OUT / "inventory.json").read_text())
reqs = {r["code"]: r for r in inv["requirements"]}
report = []


def record(name, **data):
    report.append({"test": name, **data})
    (OUT / "workflow-results.json").write_text(json.dumps(report, indent=2))
    print(name, json.dumps(data)[:250], flush=True)


def client(staff=False):
    c = httpx.Client(base_url=BASE, headers=H, timeout=180)
    r = c.post(
        "/v1/auth/demo/" + ("staff/sign-in-as" if staff else "sign-in-as"),
        json={"staffRef": "AU-55ff7e408818"} if staff else {"studentRef": "SYN-000061"},
    )
    r.raise_for_status()
    return c


student = client()
staff = client(True)


def get(c, path):
    r = c.get(path)
    r.raise_for_status()
    return r.json()


def docs():
    return get(student, "/v1/student/documents")["items"]


def board():
    return get(staff, "/v1/staff/demo-task-board")["cards"]


def reset():
    r = staff.post("/v1/staff/demo/reset", json={"confirmation": "RESET DEMO"})
    r.raise_for_status()
    record("reset", **r.json())
    assert not docs()


def upload(code, filename=None, via_staff=False, wait=True):
    req = reqs[code]
    f = FIX / (filename or req["fixture"])
    mime = "image/jpeg" if f.suffix == ".jpg" else "application/pdf"
    c = staff if via_staff else student
    path = (
        f"/v1/staff/students/{inv['studentId']}/documents/upload"
        if via_staff
        else "/v1/student/documents/upload"
    )
    r = c.post(
        path,
        headers={"Idempotency-Key": str(uuid4())},
        data={"requirementId": req["id"], "category": req["category"]},
        files={"file": (f.name, f.read_bytes(), mime)},
    )
    r.raise_for_status()
    d = r.json()
    if wait:
        for _ in range(90):
            d = next(x for x in docs() if x["id"] == d["id"])
            if d.get("extraction", {}).get("status") != "processing":
                break
            time.sleep(1)
        assert d["extraction"]["status"] != "processing", d["id"]
        record(
            "upload",
            code=code,
            file=f.name,
            staff=via_staff,
            id=d["id"],
            status=d["status"],
            extraction=d["extraction"],
        )
    return d


def edward(stage):
    for c, role, msg in [
        (
            student,
            "student",
            "What is the current status of each of my required documents, including my passport? Which still need uploading and which await staff review?",
        ),
        (
            staff,
            "staff",
            "For Ada Kettleby (SYN-000061), list the current status of each required document including passport. Which need uploading versus await staff review?",
        ),
    ]:
        body = {
            "message": msg,
            "pageContext": (
                "/enrollment"
                if role == "student"
                else {"surface": "task_board", "project": "en-docs"}
            ),
        }
        r = c.post(f"/v1/{role}/assistant/messages", json=body)
        record("Edward " + stage, role=role, status=r.status_code, response=r.json())
        r.raise_for_status()


def fields(d):
    return {x["key"]: x["value"] for x in d["extraction"].get("fields", [])}


if __name__ == "__main__":
    import runpy

    runpy.run_path("tools/conference-documents/final-workflow.py", run_name="__main__")
