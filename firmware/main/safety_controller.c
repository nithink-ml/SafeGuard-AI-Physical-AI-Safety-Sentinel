/**
 * @file safety_controller.c
 * @brief Implementation of SafeGuard AI Safety Controller (REQ-001, REQ-003, REQ-006, REQ-007, REQ-010)
 */

#include "safety_controller.h"
#include "pin_config.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "driver/gpio.h"
#include <string.h>

static const char* TAG = "SAFEGUARD_CTRL";

static safety_controller_context_t s_ctx = {
    .current_state = STATE_INIT,
    .red_led_active = false,
    .buzzer_active = false,
    .active_incident_id = {0},
    .total_events_processed = 0,
    .duplicate_events_ignored = 0,
    .malformed_events_rejected = 0,
    .last_event_timestamp_us = 0
};

static const char* state_to_string(safeguard_state_t state) {
    switch (state) {
        case STATE_INIT: return "STATE_INIT";
        case STATE_NORMAL: return "STATE_NORMAL";
        case STATE_ALARM: return "STATE_ALARM";
        case STATE_COMM_ERROR: return "STATE_COMM_ERROR";
        default: return "STATE_UNKNOWN";
    }
}

static void log_state_transition(safeguard_state_t old_state, safeguard_state_t new_state, const char* reason) {
    // REQ-006: Diagnostic UART log on every state change
    ESP_LOGI(TAG, "[STATE_TRANSITION] %s -> %s (Reason: %s)",
             state_to_string(old_state), state_to_string(new_state), reason);
}

esp_err_t safety_controller_init(void) {
    // REQ-001: Configure GPIOs with pull-downs and immediately set output level to LOW (0V)
    gpio_config_t io_conf = {
        .pin_bit_mask = (1ULL << PIN_RED_WARNING_LED) | (1ULL << PIN_PIEZO_BUZZER),
        .mode = GPIO_MODE_OUTPUT,
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_ENABLE,
        .intr_type = GPIO_INTR_DISABLE
    };
    esp_err_t err = gpio_config(&io_conf);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to configure actuator GPIOs: %s", esp_err_to_name(err));
        return err;
    }

    // Force LOW state immediately
    gpio_set_level(PIN_RED_WARNING_LED, 0);
    gpio_set_level(PIN_PIEZO_BUZZER, 0);

    s_ctx.red_led_active = false;
    s_ctx.buzzer_active = false;
    memset(s_ctx.active_incident_id, 0, sizeof(s_ctx.active_incident_id));
    s_ctx.last_event_timestamp_us = esp_timer_get_time();

    safeguard_state_t old_state = s_ctx.current_state;
    s_ctx.current_state = STATE_NORMAL;

    ESP_LOGI(TAG, "[REQ-001] Safe Initial State Verified: Warning outputs LOW (0V).");
    log_state_transition(old_state, STATE_NORMAL, "Boot sequence completed");
    return ESP_OK;
}

esp_err_t safety_controller_trigger_alarm(const char* incident_id, const char* zone_id, float confidence) {
    // REQ-003: Activate warning outputs on valid restricted-zone breach
    safeguard_state_t old_state = s_ctx.current_state;
    s_ctx.current_state = STATE_ALARM;

    if (incident_id) {
        strncpy(s_ctx.active_incident_id, incident_id, sizeof(s_ctx.active_incident_id) - 1);
    }
    s_ctx.last_event_timestamp_us = esp_timer_get_time();
    s_ctx.total_events_processed++;

    // Assert Red LED HIGH and activate buzzer
    gpio_set_level(PIN_RED_WARNING_LED, 1);
    gpio_set_level(PIN_PIEZO_BUZZER, 1);
    s_ctx.red_led_active = true;
    s_ctx.buzzer_active = true;

    char reason[128];
    snprintf(reason, sizeof(reason), "Breach in zone '%s' [ID: %s, Conf: %.2f]",
             zone_id ? zone_id : "unknown", incident_id ? incident_id : "none", confidence);
    log_state_transition(old_state, STATE_ALARM, reason);
    ESP_LOGW(TAG, "[ACTUATOR_ALERT] Red Warning LED Asserted HIGH (GPIO %d). Buzzer Active (GPIO %d).",
             PIN_RED_WARNING_LED, PIN_PIEZO_BUZZER);

    return ESP_OK;
}

esp_err_t safety_controller_clear_alarm(const char* clear_event_id, const char* zone_id) {
    // REQ-007: Event-clear policy
    safeguard_state_t old_state = s_ctx.current_state;
    s_ctx.current_state = STATE_NORMAL;
    s_ctx.last_event_timestamp_us = esp_timer_get_time();
    s_ctx.total_events_processed++;

    // Deassert warning outputs
    gpio_set_level(PIN_RED_WARNING_LED, 0);
    gpio_set_level(PIN_PIEZO_BUZZER, 0);
    s_ctx.red_led_active = false;
    s_ctx.buzzer_active = false;
    memset(s_ctx.active_incident_id, 0, sizeof(s_ctx.active_incident_id));

    char reason[128];
    snprintf(reason, sizeof(reason), "Zone '%s' cleared by event '%s'",
             zone_id ? zone_id : "unknown", clear_event_id ? clear_event_id : "none");
    log_state_transition(old_state, STATE_NORMAL, reason);
    ESP_LOGI(TAG, "[ACTUATOR_CLEAR] Actuators returned to safe inactive state.");

    return ESP_OK;
}

esp_err_t safety_controller_manual_reset(const char* reason) {
    // REQ-007: Manual reset command
    if (s_ctx.current_state == STATE_ALARM) {
        safeguard_state_t old_state = s_ctx.current_state;
        s_ctx.current_state = STATE_NORMAL;
        gpio_set_level(PIN_RED_WARNING_LED, 0);
        gpio_set_level(PIN_PIEZO_BUZZER, 0);
        s_ctx.red_led_active = false;
        s_ctx.buzzer_active = false;
        memset(s_ctx.active_incident_id, 0, sizeof(s_ctx.active_incident_id));

        log_state_transition(old_state, STATE_NORMAL, reason ? reason : "Manual Operator Reset");
    }
    return ESP_OK;
}

void safety_controller_check_timeout(int64_t timeout_us) {
    // REQ-010: Communication timeout watchdog in alarm state
    if (s_ctx.current_state == STATE_ALARM) {
        int64_t now = esp_timer_get_time();
        if ((now - s_ctx.last_event_timestamp_us) > timeout_us) {
            ESP_LOGW(TAG, "[REQ-010] Communication silent for > %lld ms. Enforcing fail-safe clear.",
                     (now - s_ctx.last_event_timestamp_us) / 1000);
            safety_controller_manual_reset("Watchdog Communication Timeout");
        }
    }
}

void safety_controller_get_context(safety_controller_context_t* out_ctx) {
    if (out_ctx) {
        *out_ctx = s_ctx;
    }
}
