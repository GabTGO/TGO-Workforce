import { createFileRoute } from "@tanstack/react-router";
import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

import {
  departmentDistribution,
  employees,
  metrics,
  officeDistribution,
  statusDistribution,
  tenureDistribution,
} from "@/data/employees";

function workforceContext() {
  const m = metrics();
  return [
    `Active: ${m.active}, Inactive: ${m.inactive}, New hires (12m): ${m.newHires}, Exits (12m): ${m.exits}.`,
    `Offices: ${JSON.stringify(officeDistribution())}`,
    `Statuses: ${JSON.stringify(statusDistribution())}`,
    `Departments: ${JSON.stringify(departmentDistribution())}`,
    `Tenure bands: ${JSON.stringify(tenureDistribution())}`,
    `Employees: ${JSON.stringify(
      employees.map((e) => ({
        id: e.id,
        name: e.name,
        office: e.office,
        department: e.department,
        position: e.position,
        startDate: e.startDate,
        status: e.status,
        exitDate: e.exitDate ?? null,
      })),
    )}`,
  ].join("\n");
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages } = (await request.json()) as { messages?: UIMessage[] };
        if (!Array.isArray(messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const lovable = createOpenAI({
          baseURL: "https://ai.gateway.lovable.dev/v1",
          apiKey,
          headers: {
            "Lovable-API-Key": apiKey,
            "X-Lovable-AIG-SDK": "vercel-ai-sdk",
          },
        });

        const result = streamText({
          model: lovable.responses("openai/gpt-5.6-sol"),
          abortSignal: request.signal,
          system: [
            "You are the TGO Workforce support assistant for an internal HR operations portal.",
            "Answer questions about employees, headcount, hiring, tenure, anniversaries, birthdays and how to use the portal (Dashboard, Directory, Analytics, New Hires, Anniversaries, Birthdays, Activity Logs, Settings).",
            "Be concise, use markdown lists or short tables when helpful, and only use the data below. If something is unknown, say so.",
            "Current workforce data:",
            workforceContext(),
          ].join("\n"),
          messages: await convertToModelMessages(messages),
          providerOptions: {
            openai: {
              forceReasoning: true,
              reasoningEffort: "low",
              reasoningSummary: "auto",
              store: false,
              include: ["reasoning.encrypted_content"],
            },
          },
        });

        return result.toUIMessageStreamResponse({ originalMessages: messages });
      },
    },
  },
});
