#!/usr/bin/env bash
# ==============================================================================
# SafeGuard AI — CraftifAI PipeGen Compiler & Engine Builder (Stage 4)
# Target Platform: NVIDIA Jetson Orin Nano / Linux x86_64 with NVIDIA TensorRT
# ==============================================================================

set -e

echo "======================================================================"
echo "    CraftifAI PipeGen v0.5.1 Pipeline Compiler & Model Optimizer     "
echo "======================================================================"

IR_FILE="perception/pipeline_ir.json"
MODEL_CONFIG="perception/model_config.json"
ONNX_PATH="perception/models/yolov8n.onnx"
ENGINE_DIR="perception/engines"
ENGINE_PATH="${ENGINE_DIR}/yolov8n_fp16.engine"

mkdir -p "${ENGINE_DIR}"
mkdir -p "perception/models"

# Check for PipeGen CLI availability
if command -v pipegen &> /dev/null; then
    echo "[STAGE 4: COMPILER] Validating Pipeline IR via PipeGen CLI..."
    pipegen validate --ir "${IR_FILE}" --strict
    echo "[STAGE 4: COMPILER] PipeGen IR validation: PASSED."
    
    echo "[STAGE 4: COMPILER] Invoking PipeGen Compiler..."
    pipegen compile \
        --ir "${IR_FILE}" \
        --target-device jetson-orin \
        --precision fp16 \
        --output-dir perception/compiled_pipeline/
else
    echo "[INFO] 'pipegen' CLI not detected in system PATH."
    echo "[INFO] Running direct TensorRT compiler pipeline using trtexec..."
fi

# Check for trtexec
if command -v trtexec &> /dev/null; then
    echo "[STAGE 4: COMPILER] Found trtexec. Building TensorRT FP16 engine..."
    
    # Export PyTorch model to ONNX if ONNX not present
    if [ ! -f "${ONNX_PATH}" ]; then
        echo "[STAGE 4: COMPILER] Exporting YOLOv8n to ONNX format (1x3x640x640)..."
        python3 -c "from ultralytics import YOLO; model = YOLO('yolov8n.pt'); model.export(format='onnx', imgsz=640, dynamic=False, opset=17)"
        mv yolov8n.onnx "${ONNX_PATH}"
    fi

    trtexec \
        --onnx="${ONNX_PATH}" \
        --saveEngine="${ENGINE_PATH}" \
        --fp16 \
        --memPoolSize=workspace:2048MiB \
        --shapes=images:1x3x640x640 \
        --verbose \
        --dumpProfile \
        --exportTimes=evidence/tensorrt_speed_report.json

    echo "[STAGE 4: COMPILER] Engine compilation COMPLETE: ${ENGINE_PATH}"
    echo "[STAGE 4: COMPILER] Speed report exported to evidence/tensorrt_speed_report.json"
else
    HOST_OS="$(uname -s)"
    HOST_ARCH="$(uname -m)"
    echo "[STATUS: BLOCKED ON HOST]"
    echo "  Reason: 'trtexec' and NVIDIA DeepStream SDK require Linux/JetPack environment with NVIDIA TensorRT."
    echo "  Current Host: ${HOST_OS} (${HOST_ARCH}) - Host lacks NVIDIA GPU / TensorRT / trtexec."
    echo "  Action Plan: To compile on physical NVIDIA Jetson or Linux GPU host:"
    echo "    1. Copy 'perception/' directory to target Jetson/Ubuntu 22.04 workstation."
    echo "    2. Run 'chmod +x perception/compile_pipeline.sh && ./perception/compile_pipeline.sh'."
    echo "    3. The compiled .engine file and speed report will be generated deterministically."
fi

