export type AcademyNotificationTone = "success" | "error" | "warning" | "info";

export interface AcademyNotification {
  id?: string;
  tone?: AcademyNotificationTone;
  title: string;
  message?: string;
}

export const academyNotificationEvent = "academy:notification";

function createNotificationId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function notifyAcademy(notification: AcademyNotification) {
  const payload: Required<AcademyNotification> = {
    id: notification.id ?? createNotificationId(),
    tone: notification.tone ?? "info",
    title: notification.title,
    message: notification.message ?? "",
  };

  if (typeof window === "undefined") {
    return payload;
  }

  window.dispatchEvent(new CustomEvent(academyNotificationEvent, { detail: payload }));
  return payload;
}
