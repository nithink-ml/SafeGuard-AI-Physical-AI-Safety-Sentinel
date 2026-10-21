/**
 * Typed SafeGuard AI REST API Client
 * Centralizes endpoint URLs, timeouts, error normalization, and response typing.
 */

import {
  SystemStatusResponse,
  DetailedHealthResponse,
  ZonesResponse,
  WorkerMovementResponse,
  AlertsResponse,
  EventsResponse,
  AnalyticsResponse,
  FrameInferenceResponse,
  SampleVideoStepResponse,
  SampleVideoInfoResponse,
  UartLogsResponse,
} from '../types/api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.method === 'POST' ? 15000 : 8000);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorDetail = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errJson = await response.json();
          if (errJson.detail) errorDetail = errJson.detail;
        } catch {}
        throw new Error(errorDetail);
      }

      return (await response.json()) as T;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error(`Request to ${endpoint} timed out`);
      }
      throw err;
    }
  }

  // 1. System Status & Health
  public async getStatus(): Promise<SystemStatusResponse> {
    return this.request<SystemStatusResponse>('/api/status');
  }

  public async getDetailedHealth(): Promise<DetailedHealthResponse> {
    return this.request<DetailedHealthResponse>('/api/health');
  }

  // 2. Hazard Zones
  public async getZones(): Promise<ZonesResponse> {
    return this.request<ZonesResponse>('/api/zones');
  }

  // 3. Worker Movement & Simulation
  public async moveWorker(x: number, y: number, actorId = 'worker-01', confidence = 0.95): Promise<WorkerMovementResponse> {
    return this.request<WorkerMovementResponse>('/api/simulate/move', {
      method: 'POST',
      body: JSON.stringify({ x, y, actor_id: actorId, confidence }),
    });
  }

  public async triggerIncursion(scenario: 'breach' | 'clear', actorId = 'worker-01'): Promise<WorkerMovementResponse> {
    return this.request<WorkerMovementResponse>('/api/simulate/incursion', {
      method: 'POST',
      body: JSON.stringify({ scenario, actor_id: actorId }),
    });
  }

  public async resetFirmware(): Promise<{ status: string; current_state: string; red_led: boolean; buzzer: boolean }> {
    return this.request('/api/firmware/reset', { method: 'POST' });
  }

  // 4. Telemetry & Logs
  public async getTelemetry(): Promise<any> {
    return this.request('/api/telemetry');
  }

  public async getUartLogs(limit = 50): Promise<UartLogsResponse> {
    return this.request<UartLogsResponse>(`/api/logs?limit=${limit}`);
  }

  // 5. Safety Alerts
  public async getAlerts(activeOnly = false): Promise<AlertsResponse> {
    return this.request<AlertsResponse>(`/api/alerts?active_only=${activeOnly}`);
  }

  public async acknowledgeAlert(alertId: string, acknowledgedBy = 'Safety Supervisor', note = 'Inspected and acknowledged'): Promise<any> {
    return this.request(`/api/alerts/${encodeURIComponent(alertId)}/ack`, {
      method: 'POST',
      body: JSON.stringify({ acknowledged_by: acknowledgedBy, note }),
    });
  }

  // 6. Safety Events History
  public async getEvents(limit = 50, eventType?: string, zoneId?: string): Promise<EventsResponse> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (eventType) params.append('event_type', eventType);
    if (zoneId) params.append('zone_id', zoneId);
    return this.request<EventsResponse>(`/api/events?${params.toString()}`);
  }

  // 7. Safety Analytics
  public async getAnalytics(): Promise<AnalyticsResponse> {
    return this.request<AnalyticsResponse>('/api/analytics');
  }

  // 8. Real-Time AI Inference
  public async inferFrame(imageBase64: string, source = 'webcam', confidenceThreshold = 0.55): Promise<FrameInferenceResponse> {
    return this.request<FrameInferenceResponse>('/api/inference/frame', {
      method: 'POST',
      body: JSON.stringify({
        image_base64: imageBase64,
        source,
        confidence_threshold: confidenceThreshold,
      }),
    });
  }

  public async getSampleVideoInfo(): Promise<SampleVideoInfoResponse> {
    return this.request<SampleVideoInfoResponse>('/api/video/sample_info');
  }

  public async stepSampleVideo(): Promise<SampleVideoStepResponse> {
    return this.request<SampleVideoStepResponse>('/api/inference/video/sample/step', {
      method: 'POST',
    });
  }

  public async resetSampleVideo(): Promise<{ status: string }> {
    return this.request('/api/inference/video/sample/reset', {
      method: 'POST',
    });
  }

  public async uploadVideo(file: File): Promise<{ filename: string; size_bytes: number; path: string; status: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const url = `${this.baseUrl}/api/upload/video`;
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }
    return response.json();
  }
}

export const api = new ApiClient(API_BASE_URL);
export default api;
