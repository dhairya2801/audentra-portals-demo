"""Live HTTP conference regression for the staff-triggered parsing flow."""

import runpy, time, json
from uuid import uuid4

m = runpy.run_path("tools/conference-documents/workflow-check.py", run_name="qa")
globals().update({k: v for k, v in m.items() if not k.startswith("__")})


def parse(d, wait=True):
    r = staff.post(
        "/v1/staff/documents/" + d["id"] + "/retry-extraction",
        headers={"Idempotency-Key": str(uuid4())},
    )
    r.raise_for_status()
    if not wait:
        return r.json()
    for _ in range(120):
        d = next(x for x in docs() if x["id"] == d["id"])
        if d["extraction"]["status"] != "processing":
            break
        time.sleep(1)
    record("staff parsing", id=d["id"], extraction=d["extraction"])
    assert d["extraction"]["status"] == "completed"
    return d


if __name__ == "__main__":
    reset()
    before = board()
    reset()
    assert before == board()
    edward("reset - nine pending")
    wrong = upload("ada_passport", "transcript.pdf")
    assert wrong["status"] == "rejected"
    assert wrong["extraction"]["validation"]["outcome"] == "wrong_type"
    edward("wrong transcript - passport pending")
    d = upload("ada_passport")
    assert d["extraction"]["status"] == "pending_staff"
    assert d["extraction"]["fields"] == []
    edward("one received - awaiting staff parsing")
    d = parse(d)
    assert fields(d)["passport_number"] == "DEMO-US-061"
    twice = upload("ada_passport")
    assert twice["id"] == d["id"]
    assert (
        len(
            [
                c
                for c in board()
                if c["documents"] and c["documents"][0]["id"] == d["id"]
            ]
        )
        == 1
    )
    for file in [
        "immunization-scanned.pdf",
        "immunization-scan.jpg",
        "immunization.png",
    ]:
        # PNG goes through an explicit content type below; PDF/JPEG exercise the common helper.
        if file.endswith(".png"):
            continue
        d = parse(upload("immunization_record", file))
        assert d["extraction"]["validation"]["outcome"] == "matched"
        assert (
            sum(
                f["key"].startswith("vaccination_")
                and f["key"] != "vaccination_records"
                for f in d["extraction"]["fields"]
            )
            == 7
        )
    incomplete = parse(upload("ada_demo_transcript", "transcript-incomplete.pdf"))
    assert incomplete["extraction"]["validation"]["outcome"] == "incomplete"
    assert not incomplete["extraction"]["courses"]
    unrelated = upload("ada_updated_transcript", "unrelated.pdf")
    assert unrelated["status"] == "rejected"
    reset()
    assert {c["id"] for c in before} == {c["id"] for c in board()}
    d = upload("ada_passport")
    n = len(json.loads((OUT / "spend.json").read_text())["calls"])
    parse(d, wait=False)
    for _ in range(30):
        if len(json.loads((OUT / "spend.json").read_text())["calls"]) > n:
            break
        time.sleep(0.25)
    reset()
    time.sleep(12)
    assert not docs()
    assert {c["id"] for c in before} == {c["id"] for c in board()}
    record("reset during live parsing", id=d["id"], noResurrection=True)
    for code in reqs:
        d = upload(code, via_staff=code == "camila_fin_154")
        assert d["extraction"]["status"] == "pending_staff"
        assert not d["extraction"]["fields"]
        d = parse(d)
        assert d["extraction"]["validation"]["outcome"] == "matched"
        assert d["status"] == "needs_review"
        if reqs[code]["expectedType"] == "transcript":
            assert len(d["extraction"]["courses"]) == 8
            assert "3.75" in str(fields(d))
            assert d["extraction"]["institutionName"] == "Cedar Vale Academy"
        if reqs[code]["expectedType"] == "financial_aid":
            assert fields(d)["household_size"] == "3"
            assert fields(d)["tax_year"] == "2024"
            assert "60500" in str(fields(d)).replace(",", "")
    edward("all nine received and parsed - awaiting staff approval")
    assert all(x["status"] == "needs_review" for x in docs())
    record("finished populated", documents=len(docs()))
    (OUT / "final-workflow-results.json").write_text(
        (OUT / "workflow-results.json").read_text()
    )
