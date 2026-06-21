"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, MessageSquare } from "lucide-react";
import type { CommunicationMessage } from "@/modules/communications/types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function RecipientMessageCenter({
  initialMessages,
}: {
  initialMessages: CommunicationMessage[];
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function markRead(messageId: string) {
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/academy/communications", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messageId }),
        });
        const payload = await response.json() as CommunicationMessage | { error?: string };
        if (!response.ok) {
          setError("error" in payload ? payload.error ?? "Could not mark message read." : "Could not mark message read.");
          return;
        }
        setMessages((current) =>
          current.map((message) =>
            message.id === messageId
              ? { ...message, status: "read", readAt: new Date().toISOString() }
              : message,
          ),
        );
      } catch {
        setError("Could not mark message read.");
      }
    });
  }

  if (messages.length === 0) {
    return (
      <div className="student-pwa-empty">
        <MessageSquare />
        <p>No administrative messages at this time.</p>
        <small>Messages generated from released Academy workflow state will appear here.</small>
      </div>
    );
  }

  return (
    <div className="student-pwa-surface-list">
      {error && <p className="ops-form-error" role="alert">{error}</p>}
      {messages.map((message) => (
        <article key={message.id} className="student-pwa-surface-row">
          <span className="student-pwa-surface-icon">
            {message.status === "read" ? <CheckCircle2 /> : <MessageSquare />}
          </span>
          <div>
            <strong>{message.subject}</strong>
            <span>{message.body}</span>
            <small>{formatDate(message.createdAt)} · {message.channel.replaceAll("_", " ")} · {message.status}</small>
          </div>
          {message.status !== "read" && (
            <button
              type="button"
              className="student-pwa-empty-link"
              onClick={() => markRead(message.id)}
              disabled={isPending}
            >
              Mark read
            </button>
          )}
        </article>
      ))}
    </div>
  );
}
