// HTTP client for the /feedback endpoints (backend/app/api/routes/feedback.py)
// — the Kanban-style bug/improvement board, open to every signed-in account.

import { apiUrl } from "@/lib/api";
import type { AccountRole } from "@/lib/session";

export type FeedbackType = "bug" | "improvement";
export type FeedbackStatus = "pending" | "working_on_it" | "resolved" | "implemented";
export type FeedbackPriority = "low" | "medium" | "high" | "urgent";

export type Feedback = {
  id: string;
  type: FeedbackType;
  title: string;
  reason: string;
  status: FeedbackStatus;
  priority: FeedbackPriority;
  createdAt: string;
  updatedAt: string;
  // Non-null only when the signed-in account is Super Admin — every other
  // role gets this as null straight from the backend (see
  // app/api/routes/feedback.py's _to_read), not just hidden client-side.
  reportedByLabel: string | null;
  // Safe for everyone — see FeedbackRead.is_own's own comment on the backend.
  // Together with Super Admin, this is exactly who can open the reply thread.
  isOwn: boolean;
  commentCount: number;
};

type BackendFeedback = {
  id: string;
  type: FeedbackType;
  title: string;
  reason: string;
  status: FeedbackStatus;
  priority: FeedbackPriority;
  created_at: string;
  updated_at: string;
  reported_by_label: string | null;
  is_own: boolean;
  comment_count: number;
};

function fromBackend(row: BackendFeedback): Feedback {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    reason: row.reason,
    status: row.status,
    priority: row.priority,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    reportedByLabel: row.reported_by_label,
    isOwn: row.is_own,
    commentCount: row.comment_count,
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, path));
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function readErrorMessage(response: Response, path: string): Promise<string> {
  const fallback = `Request to ${path} failed (${response.status})`;
  const body = await response.text();
  if (!body) return fallback;
  try {
    const parsed = JSON.parse(body) as { detail?: unknown };
    if (typeof parsed.detail === "string") return parsed.detail;
    if (Array.isArray(parsed.detail)) {
      const messages = parsed.detail
        .map((item) => (item && typeof item === "object" && "msg" in item ? String(item.msg) : null))
        .filter((msg): msg is string => Boolean(msg));
      if (messages.length > 0) return messages.join("; ");
    }
    return fallback;
  } catch {
    return body;
  }
}

export async function fetchFeedback(): Promise<Feedback[]> {
  const rows = await request<BackendFeedback[]>("/feedback");
  return rows.map(fromBackend);
}

export type FeedbackInput = {
  type: FeedbackType;
  title: string;
  reason: string;
  priority: FeedbackPriority;
};

export async function createFeedback(input: FeedbackInput): Promise<Feedback> {
  const row = await request<BackendFeedback>("/feedback", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return fromBackend(row);
}

export type FeedbackAdminPatch = Partial<{ status: FeedbackStatus; priority: FeedbackPriority }>;

/** Super Admin only — moving a card between Kanban columns and/or
 * re-triaging its priority. The backend 403s for anyone else. */
export async function updateFeedback(id: string, patch: FeedbackAdminPatch): Promise<Feedback> {
  const row = await request<BackendFeedback>(`/feedback/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return fromBackend(row);
}

export async function deleteFeedback(id: string): Promise<void> {
  await request<void>(`/feedback/${encodeURIComponent(id)}`, { method: "DELETE" });
}

// --- Reply thread ------------------------------------------------------------
// Only reachable for a card that's your own or when you're Super Admin — the
// backend 404s (not 403) for anyone else, so this thread is invisible rather
// than just locked (see app/api/routes/feedback.py's _can_access_thread).

export type FeedbackComment = {
  id: string;
  feedbackId: string;
  authorLabel: string;
  authorRole: AccountRole;
  message: string | null;
  imageData: string | null;
  createdAt: string;
  reactionCounts: Record<string, number>;
  myReactions: string[];
};

type BackendFeedbackComment = {
  id: string;
  feedback_id: string;
  author_label: string;
  author_role: AccountRole;
  message: string | null;
  image_data: string | null;
  created_at: string;
  reaction_counts: Record<string, number>;
  my_reactions: string[];
};

function commentFromBackend(row: BackendFeedbackComment): FeedbackComment {
  return {
    id: row.id,
    feedbackId: row.feedback_id,
    authorLabel: row.author_label,
    authorRole: row.author_role,
    message: row.message,
    imageData: row.image_data,
    createdAt: row.created_at,
    reactionCounts: row.reaction_counts,
    myReactions: row.my_reactions,
  };
}

export async function fetchFeedbackComments(feedbackId: string): Promise<FeedbackComment[]> {
  const rows = await request<BackendFeedbackComment[]>(
    `/feedback/${encodeURIComponent(feedbackId)}/comments`,
  );
  return rows.map(commentFromBackend);
}

export type FeedbackCommentInput = {
  message: string | undefined;
  /** A data: URL — see FeedbackComment.image_data's backend comment for why
   * this is stored inline rather than uploaded to object storage. */
  imageData: string | undefined;
};

export async function createFeedbackComment(
  feedbackId: string,
  input: FeedbackCommentInput,
): Promise<FeedbackComment> {
  const row = await request<BackendFeedbackComment>(
    `/feedback/${encodeURIComponent(feedbackId)}/comments`,
    {
      method: "POST",
      body: JSON.stringify({ message: input.message, image_data: input.imageData }),
    },
  );
  return commentFromBackend(row);
}

export async function toggleFeedbackCommentReaction(
  feedbackId: string,
  commentId: string,
  emoji: string,
): Promise<FeedbackComment> {
  const row = await request<BackendFeedbackComment>(
    `/feedback/${encodeURIComponent(feedbackId)}/comments/${encodeURIComponent(commentId)}/reactions`,
    {
      method: "POST",
      body: JSON.stringify({ emoji }),
    },
  );
  return commentFromBackend(row);
}
