export const studentOfflinePolicy = {
  cacheName: "churchcore-academy-student-shell-v1",
  cachePrefix: "churchcore-academy-student-shell-",
  scope: "/student",
  serviceWorkerUrl: "/student-sw.js",
  offlineFallbackUrl: "/student/offline",
  precacheUrls: ["/student/offline", "/academy-mark.svg"],
  neverCachePrefixes: ["/student", "/api", "/_next"],
  neverCacheTerms: ["grade", "progress", "document", "message", "transcript", "token", "secret", "launch"],
} as const;
