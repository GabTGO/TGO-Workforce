import { createFileRoute } from "@tanstack/react-router";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";

import type { Employee } from "@/data/employees";
import { fetchEmployeesForCookie } from "@/data/employee-api";
import { answerWorkforceQuestion } from "@/lib/workforce-assistant";

/** Pulls the text out of the most recent user message — that's the only
 * input the rule-based engine needs (see @/lib/workforce-assistant). */
function lastUserText(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message?.role === "user") {
      return message.parts
        .map((part) => (part.type === "text" ? part.text : ""))
        .join(" ")
        .trim();
    }
  }
  return "";
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages } = (await request.json()) as {
          messages?: UIMessage[];
        };
        if (!Array.isArray(messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        let employees: Employee[] = [];
        let rosterUnavailable = false;
        try {
          // Forward the browser's session cookie along with this
          // server-to-server call — see fetchEmployeesForCookie's doc
          // comment for why the plain browser-oriented fetchEmployees()
          // silently returned nothing here.
          employees = await fetchEmployeesForCookie(
            request.headers.get("cookie"),
          );
        } catch {
          // Answer from an empty roster rather than failing the whole
          // request, but flag it — otherwise a real fetch failure looks
          // identical to "the company genuinely has zero employees" and the
          // engine confidently reports wrong numbers instead of admitting it
          // couldn't load anything.
          rosterUnavailable = true;
        }

        let answer = answerWorkforceQuestion(lastUserText(messages), employees);
        if (rosterUnavailable) {
          answer +=
            "\n\n(I couldn't reach the employee directory just now, so the numbers above may be off — try again in a moment.)";
        }

        // Hand-write the UI-message-stream protocol the frontend already
        // expects (useChat + DefaultChatTransport in support-chat.tsx) —
        // this used to come from streamText() against an external model
        // gateway that isn't configured in this deployment. Now it's a
        // deterministic answer computed from the real roster, streamed
        // word-by-word for the same typing effect, with no model or API
        // key involved.
        const stream = createUIMessageStream({
          originalMessages: messages,
          execute: async ({ writer }) => {
            const id = crypto.randomUUID();
            writer.write({ type: "start" });
            writer.write({ type: "text-start", id });
            const words = answer.split(/(?<=\s)/);
            for (const word of words) {
              writer.write({ type: "text-delta", id, delta: word });
              await new Promise((resolve) => setTimeout(resolve, 12));
            }
            writer.write({ type: "text-end", id });
            writer.write({ type: "finish" });
          },
        });

        return createUIMessageStreamResponse({ stream });
      },
    },
  },
});
