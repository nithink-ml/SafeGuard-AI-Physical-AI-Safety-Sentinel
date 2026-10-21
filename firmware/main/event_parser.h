/**
 * @file event_parser.h
 * @brief Safety event message parsing and duplicate suppression (REQ-002, REQ-004, REQ-005)
 */

#ifndef SAFEGUARD_EVENT_PARSER_H
#define SAFEGUARD_EVENT_PARSER_H

#include <stdbool.h>
#include <stdint.h>
#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

#define MAX_EVENT_ID_LEN        64
#define MAX_ZONE_ID_LEN         64
#define DUPLICATE_HISTORY_SIZE  16

typedef enum {
    PARSER_OK = 0,
    PARSER_ERR_BUFFER_OVERFLOW = 1,
    PARSER_ERR_INVALID_JSON = 2,
    PARSER_ERR_MISSING_FIELDS = 3,
    PARSER_ERR_UNSUPPORTED_VERSION = 4,
    PARSER_ERR_INVALID_CONFIDENCE = 5,
    PARSER_DUPLICATE_IGNORED = 6
} parser_result_t;

/**
 * @brief Initialize parser buffers and duplicate history.
 */
void event_parser_init(void);

/**
 * @brief Parse a raw JSON buffer string and dispatch to safety controller.
 *
 * @param json_str Null-terminated JSON string.
 * @param length Length of buffer in bytes.
 * @return parser_result_t Status of parsing operation.
 */
parser_result_t event_parser_process_line(const char* json_str, size_t length);

#ifdef __cplusplus
}
#endif

#endif // SAFEGUARD_EVENT_PARSER_H
