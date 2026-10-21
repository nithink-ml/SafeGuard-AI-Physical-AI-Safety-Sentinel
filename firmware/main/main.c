/**
 * @file main.c
 * @brief Application entry point for SafeGuard AI ESP32 Firmware (ESP-IDF v5.5)
 */

#include <stdio.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/uart.h"
#include "esp_log.h"
#include "nvs_flash.h"

#include "pin_config.h"
#include "safety_controller.h"
#include "event_parser.h"
#include "telemetry.h"

static const char* TAG = "SAFEGUARD_MAIN";
#define UART_BUF_SIZE 2048

static void uart_rx_task(void* pvParameters) {
    uint8_t* dtmp = (uint8_t*)malloc(UART_BUF_SIZE);
    if (!dtmp) {
        ESP_LOGE(TAG, "Failed to allocate UART buffer!");
        vTaskDelete(NULL);
        return;
    }

    char line_buffer[1024];
    size_t line_len = 0;

    ESP_LOGI(TAG, "UART Receiver Task started on port %d (115200 8N1).", UART_BRIDGE_NUM);

    while (1) {
        int rx_bytes = uart_read_bytes(UART_BRIDGE_NUM, dtmp, UART_BUF_SIZE - 1, pdMS_TO_TICKS(50));
        if (rx_bytes > 0) {
            for (int i = 0; i < rx_bytes; i++) {
                char ch = (char)dtmp[i];
                if (ch == '\n' || ch == '\r') {
                    if (line_len > 0) {
                        line_buffer[line_len] = '\0';
                        // Process complete JSON line
                        event_parser_process_line(line_buffer, line_len);
                        line_len = 0;
                    }
                } else {
                    if (line_len < (sizeof(line_buffer) - 1)) {
                        line_buffer[line_len++] = ch;
                    } else {
                        // Overflow protection (REQ-004)
                        ESP_LOGW(TAG, "Line buffer overflow, discarding line.");
                        line_len = 0;
                    }
                }
            }
        }

        // Safety Watchdog check (REQ-010: 30 seconds silent alarm timeout)
        safety_controller_check_timeout(30000000LL);
    }

    free(dtmp);
    vTaskDelete(NULL);
}

void app_main(void) {
    ESP_LOGI(TAG, "==========================================================");
    ESP_LOGI(TAG, "SafeGuard AI — Physical AI Safety Sentinel Firmware v1.0.0");
    ESP_LOGI(TAG, "Target: ESP32 | Framework: ESP-IDF v5.5 | RTOS: FreeRTOS ");
    ESP_LOGI(TAG, "==========================================================");

    // Initialize Non-Volatile Storage (NVS)
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);

    // REQ-001: Safe initial state configuration BEFORE communication setup
    ESP_ERROR_CHECK(safety_controller_init());

    // Initialize Event Parser & Deduplication Ring Buffer (REQ-005)
    event_parser_init();

    // Configure UART communications driver (115200 8N1)
    uart_config_t uart_config = {
        .baud_rate = UART_BRIDGE_BAUD_RATE,
        .data_bits = UART_DATA_8_BITS,
        .parity    = UART_PARITY_DISABLE,
        .stop_bits = UART_STOP_BITS_1,
        .flow_ctrl = UART_HW_FLOWCTRL_DISABLE,
        .source_clk = UART_SCLK_DEFAULT,
    };
    ESP_ERROR_CHECK(uart_param_config(UART_BRIDGE_NUM, &uart_config));
    ESP_ERROR_CHECK(uart_driver_install(UART_BRIDGE_NUM, UART_BUF_SIZE * 2, 0, 0, NULL, 0));

    // Spawn time-critical UART Event Ingestion Task
    xTaskCreatePinnedToCore(
        uart_rx_task,
        "uart_rx_task",
        4096,
        NULL,
        configMAX_PRIORITIES - 2,
        NULL,
        1 // Core 1
    );

    // Spawn Background Live Intelligence Telemetry Task (REQ-009)
    ESP_ERROR_CHECK(telemetry_task_start());

    ESP_LOGI(TAG, "System initialization complete. Sentinel state: STATE_NORMAL.");
}
