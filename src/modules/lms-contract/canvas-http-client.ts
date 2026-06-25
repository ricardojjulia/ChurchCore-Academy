import { withRetry } from "./retry";
import { LmsProviderError } from "./moodle-http-client";

export class CanvasHttpClient {
  private readonly baseUrl: string;
  private readonly accessToken: string;

  constructor(baseUrl: string, accessToken: string) {
    this.baseUrl = baseUrl;
    this.accessToken = accessToken;
  }

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    return withRetry(
      async () => {
        const url = this.buildUrl(path, params);

        let response: Response;
        try {
          response = await fetch(url, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
              Accept: "application/json",
            },
          });
        } catch (error) {
          if (error instanceof TypeError) {
            throw new LmsProviderError({
              code: "NETWORK_ERROR",
              message: `Network error calling Canvas API: ${error.message}`,
              retryable: true,
            });
          }
          throw error;
        }

        return this.handleResponse<T>(response);
      },
      3,
      1000,
    );
  }

  async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    return withRetry(
      async () => {
        const url = this.buildUrl(path);

        let response: Response;
        try {
          response = await fetch(url, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(body),
          });
        } catch (error) {
          if (error instanceof TypeError) {
            throw new LmsProviderError({
              code: "NETWORK_ERROR",
              message: `Network error calling Canvas API: ${error.message}`,
              retryable: true,
            });
          }
          throw error;
        }

        return this.handleResponse<T>(response);
      },
      3,
      1000,
    );
  }

  async put<T>(path: string, body: Record<string, unknown>): Promise<T> {
    return withRetry(
      async () => {
        const url = this.buildUrl(path);

        let response: Response;
        try {
          response = await fetch(url, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(body),
          });
        } catch (error) {
          if (error instanceof TypeError) {
            throw new LmsProviderError({
              code: "NETWORK_ERROR",
              message: `Network error calling Canvas API: ${error.message}`,
              retryable: true,
            });
          }
          throw error;
        }

        return this.handleResponse<T>(response);
      },
      3,
      1000,
    );
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
