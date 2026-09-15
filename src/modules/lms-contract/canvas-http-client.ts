import { withRetry } from "./retry";
import { LmsProviderError } from "./moodle-http-client";

export interface CanvasTokenRefreshResult {
  accessToken: string;
  expiresAt?: string;
}

export interface CanvasTokenRefresher {
  refreshAccessToken(input: { expiredAccessToken: string }): Promise<CanvasTokenRefreshResult>;
}

export interface CanvasHttpClientOptions {
  tokenRefresher?: CanvasTokenRefresher;
}

export class CanvasHttpClient {
  private readonly baseUrl: string;
  private accessToken: string;
  private readonly tokenRefresher?: CanvasTokenRefresher;

  constructor(baseUrl: string, accessToken: string, options: CanvasHttpClientOptions = {}) {
    this.baseUrl = baseUrl;
    this.accessToken = accessToken;
    this.tokenRefresher = options.tokenRefresher;
  }

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    return withRetry(() => this.request<T>("GET", path, undefined, params), 3, 1000);
  }

  async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    return withRetry(() => this.request<T>("POST", path, body), 3, 1000);
  }

  async put<T>(path: string, body: Record<string, unknown>): Promise<T> {
    return withRetry(() => this.request<T>("PUT", path, body), 3, 1000);
  }

  private async request<T>(
    method: "GET" | "POST" | "PUT",
    path: string,
    body?: Record<string, unknown>,
    params?: Record<string, string>,
    refreshed = false,
  ): Promise<T> {
    const response = await this.fetchCanvas(method, path, body, params);

    if (response.status === 401 && this.tokenRefresher && !refreshed) {
      const previousToken = this.accessToken;
      const refreshedToken = await this.tokenRefresher.refreshAccessToken({ expiredAccessToken: previousToken });
      this.accessToken = refreshedToken.accessToken;
      return this.request<T>(method, path, body, params, true);
    }

    return this.handleResponse<T>(response);
  }

  private async fetchCanvas(
    method: "GET" | "POST" | "PUT",
    path: string,
    body?: Record<string, unknown>,
    params?: Record<string, string>,
  ) {
    const url = this.buildUrl(path, params);

    try {
      return await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          ...(method === "GET" ? {} : { "Content-Type": "application/json" }),
          Accept: "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (error) {
      if (error instanceof TypeError) {
        throw new LmsProviderError({
          code: "NETWORK_ERROR",
          message: this.redactProviderText(`Network error calling Canvas API: ${error.message}`),
          retryable: true,
        });
      }
      throw error;
    }
  }

  private redactProviderText(value: string): string {
    return value
      .replaceAll(this.accessToken, "[REDACTED]")
      .replace(/authorization\s+bearer\s+\S+/gi, "[REDACTED]");
  }

  private buildUrl(path: string, params?: Record<string, string>): string {
    const url = new URL(`${this.baseUrl}/api/v1${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }
    return url.toString();
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      if (response.status >= 500 && response.status < 600) {
        throw new LmsProviderError({
          code: "SERVER_ERROR",
          message: `Canvas server error: HTTP ${response.status}`,
          httpStatus: response.status,
          retryable: true,
        });
      }

      if (response.status >= 400 && response.status < 500) {
        throw new LmsProviderError({
          code: "CLIENT_ERROR",
          message: `Canvas client error: HTTP ${response.status}`,
          httpStatus: response.status,
          retryable: false,
        });
      }
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch {
      throw new LmsProviderError({
        code: "INVALID_RESPONSE",
        message: "Canvas returned non-JSON response",
        httpStatus: response.status,
        retryable: false,
      });
    }

    return json as T;
  }
}
