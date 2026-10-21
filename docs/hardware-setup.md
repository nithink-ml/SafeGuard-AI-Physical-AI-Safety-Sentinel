# SafeGuard AI — Hardware Setup & Wiring Guide

This guide details the physical hardware setup for deploying SafeGuard AI to an ESP32 development board and edge AI workstation.

---

## 1. Bill of Materials (BOM)

| Item | Component | Specification | Quantity | Notes |
| :---: | :--- | :--- | :---: | :--- |
| 1 | **Microcontroller** | ESP32-WROOM-32D / ESP32-S3 DevKit | 1 | Dual-Core 240MHz, 4MB Flash |
| 2 | **Warning LED** | 10mm High-Intensity Red LED | 1 | Forward Voltage: 2.0V, 20mA |
| 3 | **Current Limiting Resistor** | 330Ω 1/4W Resistor | 1 | Protects ESP32 GPIO pin |
| 4 | **Acoustic Transducer** | 5V Active Piezo Buzzer | 1 | Resonant frequency: 2.4kHz, 85dB |
| 5 | **Transistor Switch** | 2N2222 NPN BJT (or 1kΩ base drive) | 1 | Isolates buzzer inductive load |
| 6 | **Edge AI Processor** | NVIDIA Jetson Orin Nano / RTX dGPU | 1 | Runs PipeGen TensorRT pipeline |
| 7 | **Vision Sensor** | USB UVC HD Webcam / RTSP IP Camera | 1 | 1080p @ 30 FPS |
| 8 | **USB Cable** | Micro-USB / USB-C to USB-A Cable | 1 | Power & UART serial bridge |

---

## 2. Electrical Schematic & Pin Connections

```
              ESP32 DevKit Board
           ┌──────────────────────┐
           │                      │
           │  GPIO 21 (Pin 33) ───┼──► [330Ω] ──► [Anode] Red LED [Cathode] ──► GND
           │                      │
           │  GPIO 18 (Pin 30) ───┼──► [1kΩ] ──► Base [2N2222 NPN]
           │                      │                    │ Collector ──► [Buzzer -]
           │                      │                    │ [Buzzer +] ──► 5V / VBUS
           │                      │                    │ Emitter   ──► GND
           │                      │
           │  GPIO  0 (BOOT)   ───┼──► Pushbutton Switch ──► GND (Manual Reset)
           │                      │
           │  TX0 / RX0 (USB)  ───┼──► Host PC Serial Bridge (115200 8N1)
           │  GND              ───┼──► Common Ground Rail
           └──────────────────────┘
```

---

## 3. Physical Hardware Bring-Up Steps

1. **Benchtop Wiring**: Assemble the LED circuit on breadboard with 330Ω resistor connected to GPIO 21. Connect the buzzer transistor circuit to GPIO 18.
2. **Serial Connection**: Plug the ESP32 into the PC via USB. Identify the port (e.g., `/dev/ttyUSB0` on Linux or `COMx` on Windows).
3. **Flashing Firmware**:
   ```bash
   cd firmware
   idf.py set-target esp32
   idf.py -p /dev/ttyUSB0 flash monitor
   ```
4. **Initial Boot Verification**: Observe the serial monitor. Verify that `[REQ-001] Safe Initial State Verified: Warning outputs LOW (0V)` appears and that both LED and buzzer remain completely inactive.
