export type LoadingStatus = 'idle' | 'loading' | 'success' | 'error';

export interface ApiError {
  message: string;
  status: number;
}
