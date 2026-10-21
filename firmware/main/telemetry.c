/**
 * @file telemetry.c
 * @brief Implementation of Live Intelligence Telemetry Task (REQ-009)
 */

#include "telemetry.h"
#include "safety_controller.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_system.h"
#include "esp_timer.h"
#include "esp_log.h"
#include <stdio.h>

static const char* TAG = "SAFEGUARD_TELEM";

static void telemetry_task_worker(void* pvParameters) {
    ESP_LOGI(TAG, "Live Intelligence Telemetry task running (Interval: 1000ms).");

    while (1) {
        vTaskDelay(pdMS_TO_TICKS(1000));

        safety_controller_context_t ctx;
        safety_controller_get_context(&ctx);

        uint32_t free_heap = esp_get_free_heap_size();
        uint32_t uptime_sec = (uint32_t)(esp_timer_get_time() / 1000000ULL);

        const char* state_str = "STATE_NORMAL";
        if (ctx.current_state == STATE_ALARM) state_str = "STATE_ALARM";
        else if (ctx.current_state == STATE_COMM_ERROR) state_str = "STATE_COMM_ERROR";

        // Structured JSON telemetry output (REQ-009)
        printf("{\"schema_version\":\"1.0\",\"device_id\":\"ESP32-SAFEGUARD-01\","
               "\"state\":\"%s\",\"uptime_sec\":%lu,\"free_heap_bytes\":%lu,"
               "\"active_incident_id\":\"%s\",\"actuators\":{\"red_led\":%s,\"buzzer_active\":%s},"
               "\"stats\":{\"total_events_received\":%lu,\"duplicate_events_dropped\":%lu,\"malformed_events_rejected\":%lu}}\n",
               state_str,
               (unsigned long)uptime_sec,
               (unsigned long)free_heap,
               ctx.active_incident_id[0] ? ctx.active_incident_id : "none",
               ctx.red_led_active ? "true" : "false",
               ctx.buzzer_active ? "true" : "false",
               (unsigned long)ctx.total_events_processed,
               (unsigned long)ctx.duplicate_events_ignored,
               (unsigned long)ctx.malformed_events_rejected);
    }
}

esp_err_t telemetry_task_start(void) {
    BaseType_t ret = xTaskCreate(
        telemetry_task_worker,
        "telemetry_task",
        4096,
        NULL,
        tskIDLE_PRIORITY + 1,
        NULL
    );
    return (ret == pdPASS) ? ESP_OK : ESP_FAIL;
}
