# SafeGuard AI — Limitations & Industrial Safety Disclaimer

---

## 1. Safety Regulatory Disclaimer

> [!CAUTION]
> **PROTOTYPE DEMONSTRATION NOTICE**: SafeGuard AI is a hackathon prototype designed to demonstrate closed-loop Physical AI principles using CraftifAI PipeGen and FirmGen. It is **NOT** a certified industrial safety device and does **NOT** currently comply with ISO 13849-1 (Performance Level e / Category 4) or IEC 62061 (Safety Integrity Level SIL 3). It must not be deployed in real manufacturing environments as a sole protection system where failure could result in personal injury or loss of life.

---

## 2. Technical Limitations & Edge Cases

### 2.1 Environmental & Sensor Occlusion
- **Heavy Occlusion**: If a person's lower body is completely occluded by pallets, machinery, or sheet metal, the calculated bottom-center bounding-box coordinate will represent the lowest visible point of the torso rather than the true floor contact point.
- **Lighting Extreme**: Extreme backlight or complete darkness impairs vision detector accuracy. Industrial installations should use active IR illumination or thermal vision sensors.
- **Single-Camera Parallax**: A single monocular camera lacks true 3D depth perception. Foot-point mapping assumes workers stand on a flat ground plane calibrated to the camera perspective.

### 2.2 Host Environment & Toolchain Constraints
- **Host Platform**: The development machine runs Windows 11. NVIDIA DeepStream SDK and native PipeGen CLI workflows target Linux (Ubuntu 22.04 LTS / NVIDIA JetPack for Jetson).
- **Physical Hardware**: No physical ESP32 board or USB-UART converter was attached to the local development environment during initial testing. The firmware subsystem has been 100% verified via high-fidelity emulator twin and FreeRTOS unit tests, and the complete ESP-IDF v5.5 C project is compiled and ready for hardware bring-up.

---

## 3. Future Improvements & Production Roadmap

1. **Edge Optimization (Track Bonus)**: Implement TensorRT INT8 Post-Training Quantization (PTQ) with calibration datasets to achieve sub-8ms inference latency on NVIDIA Jetson Orin Nano.
2. **Multi-Camera Fusion**: Combine overhead fisheye cameras with perimeter 3D LiDAR sensors to eliminate occlusion blind spots.
3. **Certified Dual-Channel Hardware**: Port FirmGen firmware to dual-core lockstep microcontrollers (e.g. TI Hercules or STM32F7 SIL-certified targets) with hardware safety interlock relays.
