/**
 * @file pin_config.h
 * @brief Hardware pin allocations for SafeGuard AI on ESP32
 */

#ifndef SAFEGUARD_PIN_CONFIG_H
#define SAFEGUARD_PIN_CONFIG_H

#include "driver/gpio.h"

// Warning Actuator Pins
#define PIN_RED_WARNING_LED     GPIO_NUM_21     // High-intensity warning beacon LED
#define PIN_PIEZO_BUZZER        GPIO_NUM_18     // Piezoelectric buzzer output

// Input Interface Pins
#define PIN_MANUAL_RESET_BTN    GPIO_NUM_0      // Active-low emergency reset switch (BOOT button)

// UART Communications Interface
#define UART_BRIDGE_NUM         UART_NUM_0      // Default console / bridge UART
#define UART_BRIDGE_TXD         GPIO_NUM_1      // Console TX
#define UART_BRIDGE_RXD         GPIO_NUM_3      // Console RX
#define UART_BRIDGE_BAUD_RATE   115200

#endif // SAFEGUARD_PIN_CONFIG_H
