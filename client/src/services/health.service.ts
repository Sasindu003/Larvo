import api from './api';

export interface HealthData {
  status: string;
  db: 'connected' | 'disconnected';
  dbName?: string;
  host?: string;
  timestamp?: string;
}

export interface HealthStatus {
  connected: boolean;
  status: 'connected' | 'disconnected' | 'checking';
  latencyMs?: number;
  dbName?: string;
  host?: string;
  error?: string;
  lastChecked: Date;
}

export const healthService = {
  async checkHealth(): Promise<HealthStatus> {
    const startTime = performance.now();
    try {
      const res = await api.get<{ data: HealthData }>('/health', {
        headers: { 'Cache-Control': 'no-cache' },
      });
      const latencyMs = Math.round(performance.now() - startTime);
      const data = (res as any)?.data || res;
      const isConnected = data?.db === 'connected';

      return {
        connected: isConnected,
        status: isConnected ? 'connected' : 'disconnected',
        latencyMs,
        dbName: data?.dbName,
        host: data?.host,
        lastChecked: new Date(),
      };
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - startTime);
      return {
        connected: false,
        status: 'disconnected',
        latencyMs,
        error: err?.message || 'Database unreachable',
        lastChecked: new Date(),
      };
    }
  },
};
