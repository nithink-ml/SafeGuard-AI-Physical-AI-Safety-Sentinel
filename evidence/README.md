# SafeGuard AI — Evidence & Verification Directory

This directory stores verified empirical test outputs, audit logs, and acceptance reports for the SafeGuard AI project.

---

## Artifact Index

1. [`environment_report.json`](environment_report.json)
   - Machine-readable environment audit confirming Windows 11 host, NVIDIA RTX 2050 GPU, Python 3.10.0 runtime, UVC Webcam status, and toolchain statuses.
2. [`automated_test_results.txt`](automated_test_results.txt)
   - Verified raw output of 27 passing pytest unit and integration tests.
3. [`firmware_acceptance_matrix.md`](firmware_acceptance_matrix.md)
   - Formal requirement acceptance log for FirmGen REQ-001 through REQ-010.

---

## Verification Status Summary
- **Simulation Layer**: **VERIFIED & PASSING (27/27 Tests)**
- **PipeGen Stage 1–5 Artifacts**: **STAGED & SPECIFIED**
- **FirmGen PRD & C Source**: **FROZEN & GENERATED**
- **Physical Hardware**: **BLOCKED (Awaiting board)**
