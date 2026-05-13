export type SystemInfo = {
  available_ram_gb: number;
};

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

export type View = 'control' | 'history' | 'users';