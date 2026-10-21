/**
 * Formatting utilities for timestamps, byte sizes, and telemetry values
 */

export function formatTimestamp(isoOrEpoch: string | number | undefined | null): string {
  if (!isoOrEpoch) return '--:--:--';
  try {
    const d = typeof isoOrEpoch === 'number'
      ? new Date(isoOrEpoch > 1e11 ? isoOrEpoch : isoOrEpoch * 1000)
      : new Date(isoOrEpoch);
    if (isNaN(d.getTime())) return String(isoOrEpoch);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return String(isoOrEpoch);
  }
}

export function formatDateTime(isoOrEpoch: string | number | undefined | null): string {
  if (!isoOrEpoch) return '--';
  try {
    const d = typeof isoOrEpoch === 'number'
      ? new Date(isoOrEpoch > 1e11 ? isoOrEpoch : isoOrEpoch * 1000)
      : new Date(isoOrEpoch);
    if (isNaN(d.getTime())) return String(isoOrEpoch);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString('en-US', { hour12: false })}`;
  } catch {
    return String(isoOrEpoch);
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatUptime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}h ${mins}m ${secs}s`;
  }
  return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
}

/**
 * Generates and triggers download of an OSHA/ISO 45001 compliant safety audit log CSV
 */
export function exportAuditCsv(events: any[], filenamePrefix = 'safeguard_safety_audit'): void {
  const headers = ['Timestamp', 'Event_ID', 'Event_Type', 'Zone_ID', 'Severity', 'Confidence', 'Foot_X', 'Foot_Y', 'Status'];
  const rows = events.map((ev) => {
    const ts = ev.timestamp || new Date().toISOString();
    const id = ev.event_id || 'EV-UNKNOWN';
    const type = ev.event_type || 'UNKNOWN';
    const zone = ev.zone_id || 'N/A';
    const sev = ev.severity || 'LOW';
    const conf = ev.confidence ? (ev.confidence * 100).toFixed(1) + '%' : 'N/A';
    const fx = ev.foot_point?.x ?? 'N/A';
    const fy = ev.foot_point?.y ?? 'N/A';
    const status = ev.event_type === 'clear' ? 'RESOLVED' : 'ACTIVE_INCIDENT';
    return [ts, id, type, zone, sev, conf, fx, fy, status].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const dateStr = new Date().toISOString().slice(0, 10);
  link.setAttribute('download', `${filenamePrefix}_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

