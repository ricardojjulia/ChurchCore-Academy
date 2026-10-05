import { isIP } from "node:net";

export interface PilotEndpointAssessment {
  label: string;
  url: URL;
  classification: "loopback" | "private-network";
}

export function assessPilotEndpoint(label: string, rawValue: string): PilotEndpointAssessment {
  let url: URL;
  try {
    url = new URL(rawValue);
  } catch {
    throw new Error(`${label} must be a valid URL.`);
  }

  const hostname = url.hostname.toLowerCase();
  if (isLoopbackHost(hostname)) {
    return { label, url, classification: "loopback" };
  }
  if (isPrivateNetworkHost(hostname)) {
    return { label, url, classification: "private-network" };
  }
  throw new Error(`${label} must use loopback or a private-network IP address for a local pilot session.`);
}

export function sanitizedEndpoint(endpoint: PilotEndpointAssessment) {
  return `${endpoint.url.protocol}//${endpoint.url.host}`;
}

function isLoopbackHost(hostname: string) {
  return hostname === "localhost" || hostname === "::1" || hostname === "[::1]" || hostname.startsWith("127.");
}

function isPrivateNetworkHost(hostname: string) {
  if (isIP(hostname) !== 4) return false;
  const [first, second] = hostname.split(".").map(Number);
  return first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168);
}
