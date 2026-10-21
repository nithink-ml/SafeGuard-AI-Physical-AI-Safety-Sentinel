# SafeGuard AI — Environment Audit Report

**Audit Date**: October 2026  
**Auditor**: SafeGuard AI Technical Lead / Physical AI Sentinel Engineering Team  
**Audit Purpose**: Verify hardware, system dependencies, compiler toolchains, edge AI frameworks, and communication transports prior to implementation.

---

## 1. Executive Summary

| Item | Requirement | Detected State | Status | Impact & Action Plan |
| :--- | :--- | :--- | :---: | :--- |
| **OS & Arch** | Linux / Windows | Windows 11 Home Single Language (64-bit) | ✅ READY | Host environment for software prototype, tests, emulator, and dashboard. |
| **Python** | Python 3.9+ | Python 3.10.0 (64-bit) | ✅ READY | Python environment ready with NumPy, OpenCV, PyTorch, Ultralytics, Shapely, Paho-MQTT, Pytest, Streamlit. |
| **NVIDIA GPU** | NVIDIA GPU (Compute >= 7.0) | NVIDIA GeForce RTX 2050 Laptop (4GB VRAM, Driver 566.07) | ⚠️ CONFIGURED | Driver supports CUDA 12.7. PyTorch CUDA / TensorRT ready if compiled under WSL2 or Linux container. |
| **CUDA / TensorRT / DeepStream** | nvcc, trtexec, DeepStream SDK | Not in Windows host PATH | ❌ BLOCKED ON HOST | DeepStream is an NVIDIA Linux/Jetson platform stack. Documented full 5-stage PipeGen IR and provided cross-compilation pipeline scripts. |
| **CraftifAI PipeGen** | PipeGen v0.5.1 | CLI not present on Windows host | ❌ BLOCKED ON HOST | Five-stage PipeGen design artifacts (Requirements, IR graph, Model config, Compiler commands, Execution spec) generated; local testing supported via PyTorch/OpenCV pipeline. |
| **CraftifAI FirmGen** | FirmGen v0.4.1 | CLI not present on Windows host | ❌ BLOCKED ON HOST | PRD with formal requirement IDs (REQ-001–REQ-010), acceptance criteria, and traceability matrix prepared for FirmGen ingestion; C/C++ ESP-IDF source and emulator provided. |
| **ESP-IDF** | ESP-IDF v5.5 | `idf.py` not configured in PATH | ❌ BLOCKED ON HOST | Full ESP-IDF C project structure created; automated tests run against high-fidelity firmware emulator. |
| **ESP32 Hardware** | Physical ESP32 Dev Board | No serial COM ports detected | ❌ BLOCKED ON HOST | Hardware bring-up checklist provided; simulation mode handles all closed-loop tests. |
| **Camera** | UVC Webcam / Video Stream | `USB2.0 HD UVC WebCam` (Status: OK) | ✅ READY | Real live webcam perception active for video capture and real-time bounding-box foot-point tracking. |
| **MQTT Broker** | Mosquitto / Compatible Broker | Local port 1883 not listening | ⚠️ MOCK/REMOTE | Paho-MQTT client is installed. Supported by local mock transport and configurable remote public broker (`test.mosquitto.org`). |

---

## 2. Detailed Findings

### 2.1 Host System & Architecture
```powershell
Caption                   : Microsoft Windows 11 Home Single Language
Version                   : 10.0.26200
OSArchitecture            : 64-bit
Processor Architecture    : AMD64
```

### 2.2 Python Runtime & Libraries
- **Active Interpreter**: `C:\Users\asach\AppData\Local\Programs\Python\Python310\python.exe`
- **Installed Key Packages**:
  - `torch==2.9.0`
  - `torchvision==0.24.0`
  - `ultralytics==8.3.233`
  - `opencv-python==4.12.0.88` & `opencv-contrib-python==4.12.0.88`
  - `shapely==2.1.2`
  - `pydantic==2.10.3`
  - `paho-mqtt==2.1.0`
  - `pytest==9.0.2`
  - `streamlit==1.50.0`

### 2.3 NVIDIA Accelerator
```
+-----------------------------------------------------------------------------------------+
| NVIDIA-SMI 566.07                 Driver Version: 566.07         CUDA Version: 12.7     |
| GPU  Name                  Driver-Model | Memory-Usage | GPU-Util                       |
|   0  NVIDIA GeForce RTX 2050      WDDM  | 0MiB/4096MiB | 0%                             |
+-----------------------------------------------------------------------------------------+
```

### 2.4 Video Capture Interface
```powershell
FriendlyName         InstanceId                                    Status
------------         ----------                                    ------
USB2.0 HD UVC WebCam USB\VID_2B7E&PID_B685&MI_00\6&1EEBD08A&0&0000 OK
```

### 2.5 Serial Interface Audit
- `[System.IO.Ports.SerialPort]::GetPortNames()` returned **empty**.
- No USB-to-UART bridge (CP2102, CH340, FTDI) detected.

---

## 3. Engineering Decisions & Operating Strategy

1. **Strict Verification Transparency**:
   - Software and simulation layers will be tested rigorously using `pytest`.
   - Hardware requirements that cannot be executed locally will be marked `BLOCKED` with detailed instructions on how to deploy them to an NVIDIA Jetson or physical ESP32 workstation.
2. **Dual-Path Perception**:
   - **Path A (PipeGen Specification)**: Complete formal 5-stage PipeGen pipeline artifacts (`pipegen_requirements.json`, `pipeline_ir.json`, `model_config.json`, `compile_pipeline.sh`, `run_pipeline.py`).
   - **Path B (Local Live Test)**: Live webcam/video runner using PyTorch/Ultralytics with identical restricted zone polygon intersection, foot-point geometry, and persistence logic.
3. **Dual-Path Firmware**:
   - **Path A (ESP-IDF v5.5 Firmware)**: Production-grade C codebase (`main/main.c`, `main/safety_controller.c`, `main/event_parser.c`, `main/telemetry.c`) with FreeRTOS tasks, GPIO control, and UART telemetry.
   - **Path B (Firmware Emulator)**: Python-based emulator mirroring the exact finite state machine (FSM), circular deduplication buffer, and warning policies for automated test suites.
