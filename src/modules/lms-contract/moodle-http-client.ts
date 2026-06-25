import { withRetry } from "./retry";

export class LmsProviderError extends Error {
  code: string;
  httpStatus?: number;
  retryable: boolean;

  constructor(input: { code: string; message: string; httpStatus?: number; retryable: boolean }) {
    super(input.message);
    this.name = "LmsProviderError";
    this.code = input.code;
    this.httpStatus = input.httpStatus;
    this.retryable = input.retryable;
  }
}

export class MoodleHttpClient {
  private readonly baseUrl: string;
  private readonly wstoken: string;

  constructor(baseUrl: string, wstoken: string) {
    this.baseUrl = baseUrl;
    this.wstoken = wstoken;
  }

  async call<T>(wsfunction: string, params: Record<string, unknown> = {}): Promise<T> {
    return withRetry(
      async () => {
        const url = this.buildUrl(wsfunction);
        const body = this.buildFormBody(params);

        let response: Response;
        try {
          response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body,
          });
        } catch (error) {
          if (error instanceof TypeError) {
            throw new LmsProviderError({
              code: "NETWORK_ERROR",
              message: `Network error calling Moodle Web Service: ${error.message}`,
              retryable: true,
            });
          }
          throw error;
        }

        if (!response.ok) {
          if (response.status >= 500 && response.status < 600) {
            throw new LmsProviderError({
              code: "SERVER_ERROR",
              message: `Moodle server error: HTTP ${response.status}`,
              httpStatus: response.status,
              retryable: true,
            });
          }

          if (response.status >= 400 && response.status < 500) {
            throw new LmsProviderError({
              code: "CLIENT_ERROR",
              message: `Moodle client error: HTTP ${response.status}`,
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
            message: "Moodle returned non-JSON response",
            httpStatus: response.status,
            retryable: false,
          });
        }

        if (this.isMoodleException(json)) {
          throw new LmsProviderError({
            code: json.errorcode || "MOODLE_EXCEPTION",
            message: json.message || "Moodle Web Service exception",
            httpStatus: 200,
            retryable: false,
          });
        }

        return json as T;
      },
      3,
      1000,
    );
  }

  private buildUrl(wsfunction: string): string {
    const url = new URL(`${this.baseUrl}/webservice/rest/server.php`);
    url.searchParams.set("wstoken", this.wstoken);
    url.searchParams.set("moodlewsrestformat", "json");
    url.searchParams.set("wsfunction", wsfunction);
    return url.toString();
  }

  private buildFormBody(params: Record<string, unknown>): string {
    const flattened = this.flattenParams(params);
    return new URLSearchParams(flattened as Record<string, string>).toString();
  }

  private flattenParams(params: Record<string, unknown>, prefix = ""): Record<string, string | number> {
    const result: Record<string, string | number> = {};

    for (const [key, value] of Object.entries(params)) {
      const fullKey = prefix ? `${prefix}[${key}]` : key;

      if (value === null || value === undefined) {
        continue;
      }

      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          if (typeof item === "object" && item !== null) {
            Object.assign(result, this.flattenParams(item as Record<string, unknown>, `${fullKey}[${index}]`));
          } else {
            result[`${fullKey}[${index}]`] = String(item);
          }
        });
      } else if (typeof value === "object") {
        Object.assign(result, this.flattenParams(value as Record<string, unknown>, fullKey));
      } else {
        result[fullKey] = String(value);
      }
    }

    return result;
  }

  private isMoodleException(json: unknown): json is { exception: string; message: string; errorcode?: string } {
    return (
      typeof json === "object" &&
      json !== null &&
      "exception" in json &&
      typeof (json as { exception: unknown }).exception === "string"
    );
  }
}
