export interface TestResponse {
  message: string;
}

export interface DatabaseTestResponse {
  message: string;
  collections: string[];
}

export interface ApiError {
  error: string;
  details?: string;
}