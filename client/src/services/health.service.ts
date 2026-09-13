import api from './api';

export interface HealthData {
  server: 'connected' | 'disconnected';
  status: string;
  db: 'connected' | 'disconnected';
  dbName?: string;
  host?: string;
  timestamp?: string;
}

export interface HealthStatus {
  serverStatus: 'connected' | 'disconnected' | 'checking';
  dbStatus: 'connected' | 'disconnected' | 'checking';
  latencyMs?: number;
  dbName?: string;
  host?: string;
  apiUrl?: string;
  error?: string;
  lastChecked: Date;
}

export const healthService = {
  async checkHealth(): Promise<HealthStatus> {
    const startTime = performance.now();
    const apiUrl = api.defaults.baseURL || '/api';
    try {
      const res = await api.get<{ data: HealthData }>('/health', {
        headers: { 'Cache-Control': 'no-cache' },
      });
      const latencyMs = Math.round(performance.now() - startTime);
      const data = (res as any)?.data || res;
      const isDbConnected = data?.db === 'connected';

      return {
        serverStatus: 'connected',
        dbStatus: isDbConnected ? 'connected' : 'disconnected',
        latencyMs,
        dbName: data?.dbName,
        host: data?.host,
        apiUrl,
        lastChecked: new Date(),
      };
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - startTime);
      // If an HTTP status code exists (e.g. 500), the backend server responded
      const serverResponded = typeof err?.status === 'number' && err.status > 0;

      return {
        serverStatus: serverResponded ? 'connected' : 'disconnected',
        dbStatus: 'disconnected',
        latencyMs,
        apiUrl,
        error: err?.message || (serverResponded ? 'Database connection failure' : 'Backend server unreachable'),
        lastChecked: new Date(),
      };
    }
  },
};
