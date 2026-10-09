"""Reproducible, visibly marked synthetic conference evidence. Never real credentials."""

import json, math
from pathlib import Path
import fitz

DEST = Path("apps/web/public/demo-documents/ada")
DEST.mkdir(parents=True, exist_ok=True)
NAVY = (0.09, 0.18, 0.28)
TEAL = (0.12, 0.37, 0.38)
INK = (0.16, 0.2, 0.24)
MUTED = (0.4, 0.45, 0.49)
PALE = (0.94, 0.96, 0.96)
RED = (0.65, 0.17, 0.2)


def text(p, x, y, t, size=10, color=INK, bold=False):
    p.insert_text(
        (x, y), t, fontsize=size, fontname="hebo" if bold else "helv", color=color
    )


def box(p, x, y, w, h, color):
    p.draw_rect(fitz.Rect(x, y, x + w, y + h), color=None, fill=color)


def line(p, x, y, w, color=(0.8, 0.84, 0.86)):
    p.draw_line((x, y), (x + w, y), color=color, width=0.6)


def field(p, x, y, label, value):
    text(p, x, y, label.upper(), 8, MUTED)
    text(p, x, y + 17, value, 11, INK, True)


def page(issuer, dept, title, color=NAVY):
    d = fitz.open()
    p = d.new_page(width=612, height=792)
    box(p, 0, 0, 612, 12, color)
    box(p, 40, 40, 42, 42, color)
    text(p, 49, 67, issuer[0] + issuer.split()[1][0], 17, (1, 1, 1), True)
    text(p, 96, 57, issuer, 20, color, True)
    text(p, 96, 77, dept, 9, MUTED)
    line(p, 40, 100, 532)
    text(p, 40, 135, title, 21, color, True)
    text(
        p,
        40,
        757,
        "DEMO / NOT VALID  |  Fictional training evidence. No institutional validity.",
        9,
        RED,
        True,
    )
    text(p, 520, 757, "1 of 1", 8, MUTED)
    return d, p


def save(d, name):
    d.save(DEST / (name + ".pdf"))
    d[0].get_pixmap(matrix=fitz.Matrix(1.6, 1.6)).save(DEST / (name + ".png"))


# Transcript: realistic two-term table with consistent totals and GPA.
d, p = page(
    "Cedar Vale Academy",
    "OFFICE OF THE REGISTRAR  |  Fictional independent secondary school",
    "Official Academic Transcript",
)
field(p, 40, 169, "Student", "Ada Kettleby")
field(p, 325, 169, "Student reference", "SYN-000061")
field(p, 40, 215, "Date of birth", "March 8, 2007")
field(p, 325, 215, "Issued", "September 28, 2026")
field(p, 40, 261, "Attendance", "September 2022 - June 2026")
field(p, 325, 261, "Credential awarded", "High School Diploma - June 12, 2026")
courses = [
    ("Fall 2025", "ENG 401", "English Literature IV", "1.0", "A"),
    ("Fall 2025", "MAT 401", "Precalculus", "1.0", "A-"),
    ("Fall 2025", "SCI 401", "Biology with Laboratory", "1.0", "B+"),
    ("Fall 2025", "SOC 401", "United States History", "1.0", "A"),
    ("Spring 2026", "ENG 402", "Composition and Rhetoric", "1.0", "A"),
    ("Spring 2026", "MAT 402", "Calculus", "1.0", "A-"),
    ("Spring 2026", "SCI 402", "Environmental Science", "1.0", "B+"),
    ("Spring 2026", "SOC 402", "Government and Economics", "1.0", "A"),
]
box(p, 40, 306, 532, 26, NAVY)
for x, t in [
    (49, "TERM"),
    (130, "CODE"),
    (206, "COURSE"),
    (485, "CREDIT"),
    (536, "GRADE"),
]:
    text(p, x, 323, t, 8, (1, 1, 1), True)
for i, row in enumerate(courses):
    y = 332 + i * 27
    if i % 2 == 0:
        box(p, 40, y, 532, 27, PALE)
    for x, t in zip([49, 130, 206, 492, 546], row):
        text(p, x, y + 18, t, 9)
box(p, 40, 567, 532, 76, PALE)
field(p, 54, 588, "Final-year GPA / scale", "3.75 / 4.00")
field(p, 270, 588, "Credits shown", "8.0")
field(p, 425, 588, "Cumulative credits", "24.0")
text(
    p,
    40,
    671,
    "Grade scale: A = 4.00; A- = 3.67; B+ = 3.33. One credit = one year course unit.",
    9,
    MUTED,
)
text(
    p,
    40,
    695,
    "Academic record certified for demonstration by the Office of the Registrar.",
    9,
)
text(
    p,
    40,
    714,
    "Fictional issuer - no seal, signature or verification credential is provided.",
    9,
    MUTED,
)
save(d, "transcript")
# Clinic record.
d, p = page(
    "Willow Creek Clinic",
    "STUDENT HEALTH SERVICES  |  Fictional care provider",
    "Immunization Record",
    TEAL,
)
field(p, 40, 174, "Patient", "Ada Kettleby")
field(p, 330, 174, "Date of birth", "March 8, 2007")
field(p, 40, 222, "Record issued", "September 28, 2026")
field(p, 330, 222, "Patient reference", "DEMO-061")
text(p, 40, 278, "Documented administration history", 13, TEAL, True)
rows = [
    ("MMR", "1", "2008-04-10", "Willow Creek Clinic"),
    ("MMR", "2", "2012-08-20", "Willow Creek Clinic"),
    ("Varicella", "1", "2008-04-10", "Willow Creek Clinic"),
    ("Varicella", "2", "2012-08-20", "Willow Creek Clinic"),
    ("Tdap", "1", "2018-07-12", "Willow Creek Clinic"),
    ("Meningococcal ACWY", "1", "2018-07-12", "Willow Creek Clinic"),
    ("Meningococcal ACWY", "2", "2024-07-15", "Willow Creek Clinic"),
]
box(p, 40, 296, 532, 28, TEAL)
for x, t in [(50, "VACCINE"), (215, "DOSE"), (277, "DATE"), (379, "PROVIDER")]:
    text(p, x, 315, t, 9, (1, 1, 1), True)
for i, row in enumerate(rows):
    y = 324 + i * 34
    if i % 2 == 0:
        box(p, 40, y, 532, 34, PALE)
    for x, t in zip([50, 229, 277, 379], row):
        text(p, x, y + 21, t, 10)
box(p, 40, 588, 532, 72, PALE)
text(p, 54, 612, "Record notes", 11, TEAL, True)
text(p, 54, 634, "No exemptions or titer results are documented on this record.", 10)
text(
    p,
    40,
    696,
    "Prepared by: Elise Rowan, RN - fictional provider for training purposes.",
    10,
)
text(
    p,
    40,
    715,
    "This record supports review only; it does not establish medical clearance.",
    9,
    MUTED,
)
save(d, "immunization")
# Financial verification worksheet.
d, p = page(
    "Aster University",
    "OFFICE OF FINANCIAL AID  |  Synthetic demo campus",
    "Household Income Verification",
)
field(p, 40, 173, "Student", "Ada Kettleby")
field(p, 330, 173, "Institution reference", "SYN-000061")
field(p, 40, 221, "Academic year", "2026-2027")
field(p, 330, 221, "Tax year reviewed", "2024")
text(p, 40, 278, "Section A  |  Household information", 13, NAVY, True)
box(p, 40, 295, 532, 77, PALE)
field(p, 55, 320, "Household size", "3")
field(p, 330, 320, "Students in college", "1")
text(p, 40, 410, "Section B  |  Annual income reported", 13, NAVY, True)
for i, (label, value) in enumerate(
    [
        ("Parent / guardian income", "$58,400.00 USD"),
        ("Student earned income", "$2,100.00 USD"),
        ("Total household income", "$60,500.00 USD"),
    ]
):
    y = 427 + i * 42
    box(p, 40, y, 532, 42, PALE if i % 2 == 0 else (1, 1, 1))
    text(p, 54, y + 26, label, 11)
    text(p, 430, y + 26, value, 11, INK, True)
text(p, 40, 596, "Section C  |  Attestation", 13, NAVY, True)
text(
    p,
    40,
    621,
    "The amounts above are synthetic figures submitted for conference demonstration.",
    10,
)
field(p, 40, 655, "Typed attestation", "Ada Kettleby - DEMO ONLY")
field(p, 330, 655, "Date completed", "September 28, 2026")
text(
    p,
    40,
    718,
    "No SSN, bank account, tax-return identifier or functional signature is included.",
    9,
    MUTED,
)
save(d, "financial-aid")
# Clearly invalid US-style biographical specimen, no seal/MRZ/barcode/security features.
d = fitz.open()
p = d.new_page(width=720, height=480)
box(p, 0, 0, 720, 480, (0.94, 0.94, 0.88))
box(p, 0, 0, 720, 58, NAVY)
text(p, 27, 36, "UNITED STATES OF AMERICA", 22, (1, 1, 1), True)
text(p, 574, 34, "PASSPORT", 12, (1, 1, 1), True)
for i in range(15):
    line(p, 20, 78 + i * 22, 680, (0.86, 0.9, 0.89))
p.insert_image(
    fitz.Rect(28, 96, 218, 312), filename=str(DEST / "synthetic-portrait.png")
)
text(p, 38, 328, "AI-GENERATED PORTRAIT", 8, MUTED)
field(p, 244, 91, "Type / Country", "P / USA")
field(p, 473, 91, "Passport number", "DEMO-US-061")
field(p, 244, 143, "Surname", "KETTLEBY")
field(p, 244, 191, "Given names", "ADA")
field(p, 473, 143, "Nationality", "UNITED STATES OF AMERICA")
field(p, 473, 191, "Date of birth", "08 MAR 2007")
field(p, 244, 239, "Place of birth", "OHIO, U.S.A.")
field(p, 473, 239, "Sex", "F")
field(p, 244, 287, "Date of issue", "20 SEP 2025")
field(p, 473, 287, "Date of expiration", "19 SEP 2035")
field(p, 244, 335, "Issuing country", "UNITED STATES OF AMERICA")
text(p, 28, 365, "DEMONSTRATION SPECIMEN - NOT ISSUED BY ANY GOVERNMENT", 11, RED, True)
box(p, 20, 390, 680, 64, (0.89, 0.9, 0.87))
text(p, 38, 417, "DEMO / NOT VALID", 20, RED, True)
text(
    p,
    38,
    440,
    "No machine-readable zone. No travel, identity or legal validity.",
    11,
    INK,
)
save(d, "passport")
# Image-only PDF + JPEG for scanned coverage; same visible evidence, no text layer.
scan = fitz.open()
scan_page = scan.new_page(width=612, height=792)
scan_page.insert_image(scan_page.rect, filename=str(DEST / "immunization.png"))
scan.save(DEST / "immunization-scanned.pdf")
fitz.Pixmap(str(DEST / "immunization.png")).save(DEST / "immunization-scan.jpg")
# Deliberately incomplete/irrelevant and corrupt fixtures, separate from presenter defaults.
d, p = page(
    "Cedar Vale Academy", "OFFICE OF THE REGISTRAR", "Transcript - partial copy"
)
field(p, 40, 180, "Student", "Ada Kettleby")
text(p, 40, 240, "Coursework pages are missing from this copy.", 12)
d.save(DEST / "transcript-incomplete.pdf")
d, p = page("Willow Creek Cafe", "FICTIONAL RECEIPT", "Purchase receipt")
text(p, 40, 190, "Coffee and blueberry muffin - $8.50", 14)
d.save(DEST / "unrelated.pdf")
(DEST / "corrupt.pdf").write_bytes(b"%PDF-1.7\ninvalid truncated file")
(DEST / "manifest.json").write_text(
    json.dumps(
        {
            "persona": {
                "name": "Ada Kettleby",
                "reference": "SYN-000061",
                "birthDate": "2007-03-08",
            },
            "expected": {
                "transcript": {
                    "studentName": "Ada Kettleby",
                    "institutionName": "Cedar Vale Academy",
                    "courseCount": 8,
                    "gpa": "3.75",
                    "credits": "8.0",
                },
                "passport": {
                    "passport_number": "DEMO-US-061",
                    "date_of_birth": "2007-03-08",
                    "expiry_date": "2035-09-19",
                    "nationality": "UNITED STATES OF AMERICA",
                },
                "immunization": {
                    "doseCount": 7,
                    "provider": "Willow Creek Clinic",
                    "lastDose": "2024-07-15",
                },
                "financial-aid": {
                    "household_size": "3",
                    "tax_year": "2024",
                    "household_income": "60500",
                    "academicTerm": "2026-2027",
                },
            },
        },
        indent=2,
    )
)
print("Four polished documents and scanned/edge fixtures generated.")
