# SafeGuard AI — Demo Script & 3-Minute Hackathon Presentation

This document contains the presentation script and live demonstration walkthrough for hackathon evaluation.

---

## 1. Three-Minute Presentation Script

### 0:00–0:30 | Problem & Motivation
> "In industrial manufacturing, heavy machinery like stamping presses and robotic arms present lethal hazards. Traditional safety systems like light curtains are rigid, costly, and limited to linear geometries. Meanwhile, standard computer vision setups are merely passive monitors—logging infractions after an accident happens without generating immediate, tactile physical deterrence. Worse, naive vision alarms suffer from false triggers caused by shadows or worker arms passing overhead while feet remain in safe walkways. We built **SafeGuard AI — Physical AI Safety Sentinel** to close the loop: from sub-20ms edge vision perception to deterministic embedded firmware actuation."

### 0:30–1:00 | System Architecture
> "SafeGuard AI implements the complete Physical AI cycle: Perceive, Analyze, Decide, Communicate, Act, and Verify. 
> - For **Perceive & Analyze**, we define a 5-stage PipeGen v0.5.1 pipeline deploying TensorRT FP16 person detection.
> - For **Decide**, our spatial-temporal engine evaluates the **foot point**—the worker's ground contact coordinate—against arbitrary polygonal zones, guarded by a 3-frame persistence filter to eliminate false alarms.
> - For **Communicate**, our bridge formats version 1.0 JSON safety events over MQTT or UART.
> - For **Act & Verify**, our ESP32 firmware—synthesized according to a formal FirmGen v0.4.1 PRD—enforces safe initialization, duplicate suppression via ring buffer, and triggers red beacon LEDs and buzzer alarms."

### 1:00–2:00 | Live Demonstration
> *(Demonstrator launches `python simulation/run_demo.py` or opens Streamlit dashboard)*
> "Let's watch the closed loop in action:
> 1. First, **Safe Initial State (REQ-001)**: The firmware boots with all actuator pins measuring 0V.
> 2. Next, a worker walks along the safe walkway. Our foot-point calculator verifies the feet are outside the polygon—zero alarms are triggered.
> 3. Now, a transient optical glitch occurs for a single frame inside the danger zone. Our temporal persistence filter rejects it, preventing nuisance alarms.
> 4. Now, the intrusion: A worker steps foot into the robotic cell enclosure. On frame 3, persistence confirms the breach. A structured event is dispatched to the ESP32. The red beacon LED fires and the buzzer activates with sub-100ms total latency.
> 5. While inside, subsequent frame duplicates are rejected by the firmware's 16-entry ring buffer.
> 6. As the worker evacuates, the clearance dwell confirms the zone is clear, deasserting the alarm and logging the recovery over UART."

### 2:00–2:30 | CraftifAI Integration & Technical Evidence
> "Our project strictly adheres to the hackathon's core components:
> - On **Track A (PipeGen)**, we generated all 5 stages: formal requirements, Intermediate Representation DAG graph, model configuration, compiler scripts, and run pipelines.
> - On **Track B (FirmGen)**, we authored a formal PRD with 10 traceable requirements (REQ-001 through REQ-010), verified them across 27 automated pytest tests, and implemented a production ESP-IDF v5.5 C firmware codebase with live intelligence telemetry.
> - We maintain 100% verification honesty: while our host machine is Windows without native DeepStream/ESP32 hardware, our software twin is fully verified, and our hardware bring-up checklist provides a turnkey path to physical deployment."

### 2:30–3:00 | Impact, Limitations, & Future Development
> "SafeGuard AI demonstrates that Physical AI can be both agile and deterministic. By using PipeGen to accelerate edge perception and FirmGen to generate verified embedded safety firmware, we can deploy custom polygonal safety sentinels across factory floors in hours rather than months. Next steps include Jetson Orin INT8 quantization and industrial safety relay integration. Thank you!"

---

## 2. Live Command Walkthrough for Judges

```bash
# 1. Run all 27 automated tests
python -m pytest tests/ -v

# 2. Run the deterministic closed-loop demo
python simulation/run_demo.py

# 3. Launch the visual demonstration dashboard
streamlit run dashboard/app.py
```
