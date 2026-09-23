/**
 * Redacts an IP address for privacy-conscious storage.
 * IPv4: zeros the last octet (e.g., 192.168.1.123 → 192.168.1.0)
 * IPv6: zeros the last 64 bits / interface identifier
 * Returns null if the IP cannot be determined or parsed.
 */
export function redactIpAddress(rawIp: string | undefined): string | null {
  if (!rawIp || typeof rawIp !== "string" || rawIp.trim().length === 0) {
    return null;
  }

  const ip = rawIp.trim();

  // IPv4 detection: contains dots, no colons
  if (ip.includes(".") && !ip.includes(":")) {
    const parts = ip.split(".");
    if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p))) {
      // Validate each octet is in range 0-255
      const octets = parts.map(Number);
      if (octets.every((n) => n >= 0 && n <= 255)) {
        // Replace last octet with 0
        return `${octets[0]}.${octets[1]}.${octets[2]}.0`;
      }
    }
  }

  // IPv6 detection: contains colons
  if (ip.includes(":")) {
    try {
      // Simplified IPv6 redaction: replace last 64 bits with zeros
      // Split on "::" if present (compressed notation)
      const hasCompression = ip.includes("::");

      if (hasCompression) {
        // For compressed IPv6, we can't reliably determine the interface ID boundary
        // without full parsing. Simple approach: replace everything after the first
        // "::" with zeros, or if "::" is at the end, replace the last segment group.
        const parts = ip.split("::");
        if (parts.length === 2) {
          // Keep the network prefix (left of ::), zero the rest
          return `${parts[0]}::0`;
        }
      }

      // Full form IPv6: split into 8 groups, zero the last 4 groups (64 bits)
      const groups = ip.split(":");
      if (groups.length === 8) {
        return `${groups.slice(0, 4).join(":")}:0:0:0:0`;
      }
    } catch {
      return null;
    }
  }

  // Unable to parse
  return null;
}
