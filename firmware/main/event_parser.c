/**
 * @file event_parser.c
 * @brief Implementation of Event Parser and Circular Ring-Buffer Deduplication (REQ-002, REQ-004, REQ-005)
 */

#include "event_parser.h"
#include "safety_controller.h"
#include "cJSON.h"
#include "esp_log.h"
#include <string.h>

static const char* TAG = "SAFEGUARD_PARSER";

// Circular ring buffer for recent event IDs (REQ-005)
static char s_history[DUPLICATE_HISTORY_SIZE][MAX_EVENT_ID_LEN];
static uint8_t s_history_head = 0;
static uint8_t s_history_count = 0;

void event_parser_init(void) {
    memset(s_history, 0, sizeof(s_history));
    s_history_head = 0;
    s_history_count = 0;
    ESP_LOGI(TAG, "Event parser initialized. Duplicate window: %d entries.", DUPLICATE_HISTORY_SIZE);
}

static bool is_duplicate(const char* event_id) {
    if (!event_id || strlen(event_id) == 0) return false;
    for (uint8_t i = 0; i < s_history_count; i++) {
        if (strncmp(s_history[i], event_id, MAX_EVENT_ID_LEN) == 0) {
            return true;
        }
    }
    return false;
}

static void push_history(const char* event_id) {
    if (!event_id) return;
    strncpy(s_history[s_history_head], event_id, MAX_EVENT_ID_LEN - 1);
    s_history[s_history_head][MAX_EVENT_ID_LEN - 1] = '\0';
    s_history_head = (s_history_head + 1) % DUPLICATE_HISTORY_SIZE;
    if (s_history_count < DUPLICATE_HISTORY_SIZE) {
        s_history_count++;
    }
}

parser_result_t event_parser_process_line(const char* json_str, size_t length) {
    if (!json_str || length == 0) {
        return PARSER_ERR_INVALID_JSON;
    }

    if (length > 1024) {
        ESP_LOGE(TAG, "[REQ-004] Buffer overflow rejected (> 1024 bytes). Length: %zu", length);
        return PARSER_ERR_BUFFER_OVERFLOW;
    }

    cJSON* root = cJSON_ParseWithLength(json_str, length);
    if (!root) {
        ESP_LOGW(TAG, "[REQ-004] Malformed JSON payload received: %.*s", (int)length, json_str);
        return PARSER_ERR_INVALID_JSON;
    }

    // Mandatory schema fields check
    cJSON* j_version = cJSON_GetObjectItem(root, "schema_version");
    cJSON* j_id = cJSON_GetObjectItem(root, "event_id");
    cJSON* j_type = cJSON_GetObjectItem(root, "event_type");

    if (!cJSON_IsString(j_version) || !cJSON_IsString(j_id) || !cJSON_IsString(j_type)) {
        ESP_LOGW(TAG, "[REQ-004] Missing mandatory protocol fields.");
        cJSON_Delete(root);
        return PARSER_ERR_MISSING_FIELDS;
    }

    if (strcmp(j_version->valuestring, "1.0") != 0) {
        ESP_LOGW(TAG, "[REQ-004] Unsupported protocol schema version: %s", j_version->valuestring);
        cJSON_Delete(root);
        return PARSER_ERR_UNSUPPORTED_VERSION;
    }

    const char* event_id = j_id->valuestring;
    const char* event_type = j_type->valuestring;

    // Handle Heartbeat
    if (strcmp(event_type, "heartbeat") == 0) {
        cJSON_Delete(root);
        return PARSER_OK;
    }

    // Handle Manual Reset
    if (strcmp(event_type, "manual_reset") == 0) {
        safety_controller_manual_reset("UART Protocol Reset Command");
        cJSON_Delete(root);
        return PARSER_OK;
    }

    // REQ-005: Duplicate event suppression
    if (is_duplicate(event_id)) {
        ESP_LOGW(TAG, "[REQ-005] Duplicate event '%s' ignored (Present in ring buffer).", event_id);
        cJSON_Delete(root);
        return PARSER_DUPLICATE_IGNORED;
    }

    // Process Safety Events
    if (strcmp(event_type, "restricted_zone_entry") == 0) {
        cJSON* j_zone = cJSON_GetObjectItem(root, "zone_id");
        cJSON* j_conf = cJSON_GetObjectItem(root, "confidence");

        if (!cJSON_IsString(j_zone) || !cJSON_IsNumber(j_conf)) {
            ESP_LOGW(TAG, "[REQ-004] Missing zone_id or confidence in entry event.");
            cJSON_Delete(root);
            return PARSER_ERR_MISSING_FIELDS;
        }

        float confidence = (float)j_conf->valuedouble;
        if (confidence < 0.0f || confidence > 1.0f) {
            ESP_LOGW(TAG, "[REQ-004] Confidence score out of bounds: %f", confidence);
            cJSON_Delete(root);
            return PARSER_ERR_INVALID_CONFIDENCE;
        }

        // Record into duplicate history buffer
        push_history(event_id);

        // REQ-003: Trigger physical alarm outputs
        safety_controller_trigger_alarm(event_id, j_zone->valuestring, confidence);

    } else if (strcmp(event_type, "restricted_zone_clear") == 0) {
        cJSON* j_zone = cJSON_GetObjectItem(root, "zone_id");
        const char* zone_str = cJSON_IsString(j_zone) ? j_zone->valuestring : "unknown";

        push_history(event_id);

        // REQ-007: Clear alarm outputs
        safety_controller_clear_alarm(event_id, zone_str);
    } else {
        ESP_LOGW(TAG, "[REQ-004] Unrecognized event_type: '%s'", event_type);
        cJSON_Delete(root);
        return PARSER_ERR_MISSING_FIELDS;
    }

    cJSON_Delete(root);
    return PARSER_OK;
}
