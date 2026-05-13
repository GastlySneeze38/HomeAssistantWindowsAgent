export type CpuInfo = {
  usage_percent: number;
  frequency_mhz: number;
  core_count: number;
  temperature_celsius: number | null;
};

export type RamInfo = {
  total_gb: number;
  used_gb: number;
  available_gb: number;
  usage_percent: number;
};

export type NetworkInfo = {
  name: string;
  received_kb: number;
  transmitted_kb: number;
};


export type GpuInfo = {
  name: string;
  usage_percent: number;
  vram_total_mb: number;
  vram_used_mb: number;
  temperature_celsius: number;
};

export type WindowInfo = {
  title: string;
};

export type DashboardData = {
  cpu: CpuInfo;
  ram: RamInfo;
  network: NetworkInfo[];
  uptime_seconds: number;
  gpu: GpuInfo | null;
  active_windows: WindowInfo[];
};

export type SystemInfo = { available_ram_gb: number };

export type LaunchResponse = {
  success: boolean;
  stdout: string;
  stderr: string;
  error: string | null;
};

export type CloseResponse = {
  success: boolean;
  stdout: string;
  stderr: string;
  error: string | null;
};

export type HistoryEntry = {
  id: number;
  user_id: number;
  action_type: string;
  command: string;
  success: boolean;
  error: string | null;
  timestamp: string;
};

export type View = 'dashboard' | 'control' | 'history' | 'users';
