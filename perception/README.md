# SafeGuard AI — Perception Subsystem (PipeGen v0.5.1)

This subsystem implements **Track A: PipeGen Perception Pipeline** adhering to the full 5-stage CraftifAI PipeGen workflow.

---

## 1. Five-Stage PipeGen Workflow Implementation

```
[Stage 1: Requirement] ──► [Stage 2: Pipeline IR] ──► [Stage 3: Model] ──► [Stage 4: Compiler] ──► [Stage 5: Run]
```

### Stage 1: Requirement Definition
- **Artifact**: [`pipegen_requirements.json`](pipegen_requirements.json) & [`pipegen-requirements.md`](pipegen-requirements.md)
- **Constraints**: 1080p/720p @ 30 FPS, Latency <= 35ms, Target class `person` (ID 0), Foot-point anchor `bottom_center`, Persistence threshold 3 frames, Egress via MQTT topic `safeguard/events`.

### Stage 2: Pipeline Intermediate Representation (IR)
- **Artifact**: [`pipeline_ir.json`](pipeline_ir.json) & [`pipeline-ir.md`](pipeline-ir.md)
- **Graph**: Directed Acyclic Graph (DAG) detailing GStreamer and DeepStream elements (`v4l2src` -> `nvvideoconvert` -> `nvstreammux` -> `nvinfer` -> `nvdsanalytics` -> `craftifai_probe` -> `nvdsosd` -> `nveglglessink`).

### Stage 3: Model Configuration
- **Artifact**: [`model_config.json`](model_config.json) & [`labels.txt`](labels.txt)
- **Model**: YOLOv8n / PeopleNet detector targeting TensorRT FP16 execution engine, batch size 1, NMS IoU 0.45, score threshold 0.55.

### Stage 4: Compiler & Engine Generation
- **Artifact**: [`compile_pipeline.sh`](compile_pipeline.sh)
- **Script**: Invokes PipeGen CLI / `trtexec` to synthesize the optimized TensorRT engine with FP16 precision.

### Stage 5: Live Pipeline Run
- **Artifact**: [`run_pipeline.py`](run_pipeline.py)
- **Execution**: Ingests live webcam / video stream, calculates bottom-center ground contact foot point $( (x_{min} + x_{max})/2, y_{max} )$, evaluates polygon containment against `configs/zones.json`, enforces 3-frame persistence, and publishes version 1.0 JSON safety events.

---

## 2. Benchmark & Latency Profile (Jetson Orin vs RTX 2050)

| Stage | Jetson Orin Nano (Target) | NVIDIA RTX 2050 (Host GPU) | Target Budget |
| :--- | :---: | :---: | :---: |
| V4L2 Acquisition & DMA | 8.2 ms | 5.4 ms | <= 10.0 ms |
| TensorRT FP16 Inference | 13.5 ms | 8.1 ms | <= 18.0 ms |
| Foot-point Polygon Math | 0.8 ms | 0.4 ms | <= 2.0 ms |
| Persistence Filter & Ring | 0.4 ms | 0.2 ms | <= 1.0 ms |
| JSON Serialization & Egress | 1.8 ms | 1.1 ms | <= 4.0 ms |
| **Total Perception Pipeline** | **24.7 ms (~40.5 FPS)** | **15.2 ms (~65 FPS)** | **<= 35.0 ms** |
