/**
 * @file telemetry.h
 * @brief Live Intelligence Telemetry task for ESP32 firmware (REQ-009)
 */

#ifndef SAFEGUARD_TELEMETRY_H
#define SAFEGUARD_TELEMETRY_H

#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Start the FreeRTOS background telemetry task emitting JSON every 1000ms.
 */
esp_err_t telemetry_task_start(void);

#ifdef __cplusplus
}
#endif

#endif // SAFEGUARD_TELEMETRY_H
