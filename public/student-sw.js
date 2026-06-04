const CACHE_NAME = "churchcore-academy-student-shell-v1";
const CACHE_PREFIX = "churchcore-academy-student-shell-";
const OFFLINE_FALLBACK_URL = "/student/offline";
const PRECACHE_URLS = [OFFLINE_FALLBACK_URL, "/academy-mark.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isStudentNavigation =
    event.request.mode === "navigate" &&
    url.origin === self.location.origin &&
    (url.pathname === "/student" || url.pathname.startsWith("/student/"));

  if (!isStudentNavigation) {
    return;
  }

  event.respondWith(
    fetch(event.request, { cache: "no-store" }).catch(async () => {
      const fallback = await caches.match(OFFLINE_FALLBACK_URL);
      return fallback ?? Response.error();
    }),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "CLEAR_STUDENT_SHELL_CACHE") {
    event.waitUntil(caches.delete(CACHE_NAME));
  }
});
