# PipeGen Stage 1: Pipeline Requirements Specification

**Tool**: CraftifAI PipeGen v0.5.1  
**Project**: SafeGuard AI — Physical AI Safety Sentinel  
**Stage**: 1 — Requirement Definition

---

## 1. Perception Objectives & Operational Constraints

1. **Safety Enclosure Monitoring**: Continuously monitor defined geometric hazard zones on industrial shop floors using edge computer vision.
2. **Primary Detection Target**: Class `person` (COCO class ID 0).
3. **Foot-Point Anchor Geometry**: For every bounding box $[x_{min}, y_{min}, x_{max}, y_{max}]$, compute the ground contact point $P_{foot} = (\frac{x_{min} + x_{max}}{2}, y_{max})$.
4. **Temporal Stability**: Require 3 consecutive frames of positive spatial containment before declaring a breach event to prevent nuisance trips.
5. **Deterministic Egress**: Output structured JSON safety events over an MQTT or serial bridge with sub-100ms total closed-loop latency.

## 2. Platform Targets

- **Primary Target**: NVIDIA Jetson Orin Nano / AGX Orin (JetPack 6.0, DeepStream 7.0, TensorRT 10.x).
- **Secondary Target**: x86_64 host with NVIDIA GeForce / RTX dGPU (Compute capability >= 7.0).
- **Execution Target Latency**:
  - Image Acquisition & Decode: < 10 ms
  - Model Inference (TensorRT FP16): < 15 ms
  - Foot-Point Polygon Containment & Persistence: < 2 ms
  - Total Edge Perception Latency: **< 27 ms (< 35 ms budget)**
