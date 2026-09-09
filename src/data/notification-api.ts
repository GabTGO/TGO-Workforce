// HTTP client for the /notifications endpoints (backend/app/api/routes/notifications.py).
// Mirrors src/data/employee-api.ts's shape exactly. @/data/notification-store
// wraps these in React Query hooks; components should use that, not this
// file, directly.

import { apiUrl } from "@/lib/api";

export interface Notification {
  id: number;
  title: string;
  body: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

type BackendNotification = {
  id: number;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

function fromBackend(row: BackendNotification): Notification {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    link: row.link,
    isRead: row.is_read,
    createdAt: row.created_at,
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!response.ok) {
    throw new Error(`Request to ${path} failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function fetchNotifications(unreadOnly = false): Promise<Notification[]> {
  const params = new URLSearchParams({ limit: "30" });
  if (unreadOnly) params.set("unread_only", "true");
  const rows = await request<BackendNotification[]>(`/notifications?${params.toString()}`);
  return rows.map(fromBackend);
}

export async function fetchUnreadCount(): Promise<number> {
  const data = await request<{ count: number }>("/notifications/unread-count");
  return data.count;
}

export async function markNotificationRead(id: number): Promise<Notification> {
  const row = await request<BackendNotification>(`/notifications/${id}/read`, { method: "POST" });
  return fromBackend(row);
}

export async function markAllNotificationsRead(): Promise<void> {
  await request<void>("/notifications/read-all", { method: "POST" });
}
