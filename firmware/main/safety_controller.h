/**
 * @file safety_controller.h
 * @brief Safety Finite State Machine and actuator driver (REQ-001, REQ-003, REQ-007, REQ-010)
 */

#ifndef SAFEGUARD_SAFETY_CONTROLLER_H
#define SAFEGUARD_SAFETY_CONTROLLER_H

#include <stdbool.h>
#include <stdint.h>
#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef enum {
    STATE_INIT = 0,
    STATE_NORMAL = 1,
    STATE_ALARM = 2,
    STATE_COMM_ERROR = 3
} safeguard_state_t;

typedef struct {
    safeguard_state_t current_state;
    bool red_led_active;
    bool buzzer_active;
    char active_incident_id[64];
    uint32_t total_events_processed;
    uint32_t duplicate_events_ignored;
    uint32_t malformed_events_rejected;
    int64_t last_event_timestamp_us;
} safety_controller_context_t;

/**
 * @brief Initialize warning outputs to safe inactive state (REQ-001).
 */
esp_err_t safety_controller_init(void);

/**
 * @brief Trigger alarm state on restricted zone breach (REQ-003).
 */
esp_err_t safety_controller_trigger_alarm(const char* incident_id, const char* zone_id, float confidence);

/**
 * @brief Clear alarm state and return to normal operation (REQ-007).
 */
esp_err_t safety_controller_clear_alarm(const char* clear_event_id, const char* zone_id);

/**
 * @brief Manual reset command execution (REQ-007).
 */
esp_err_t safety_controller_manual_reset(const char* reason);

/**
 * @brief Evaluate watchdog communication timeout (REQ-010).
 */
void safety_controller_check_timeout(int64_t timeout_us);

/**
 * @brief Retrieve a snapshot of the current safety controller context.
 */
void safety_controller_get_context(safety_controller_context_t* out_ctx);

#ifdef __cplusplus
}
#endif

#endif // SAFEGUARD_SAFETY_CONTROLLER_H
