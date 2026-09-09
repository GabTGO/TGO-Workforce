// Builds the "Notify" message for a new hire — ported from the standalone
// onboarding app's src/pages/Dashboard.tsx. Structured pieces are built once
// and rendered two ways: buildNotifyText() turns them into the plain string
// actually posted to Cliq (using Cliq's own *bold* markdown and a plain ✓
// mark, since Cliq renders that itself), and the Notify dialog renders the
// same pieces as JSX so the preview looks like what will actually show up in
// Cliq, rather than raw markdown asterisks.

import type { NewHire } from "@/data/new-hire-api";

const NOTIFY_STEPS: { key: keyof NewHire; label: string; doneWord: string }[] = [
  { key: "joDiscussion", label: "Job Offer Discussion", doneWord: "Done" },
  { key: "confirmationSigned", label: "Confirmation Sheet", doneWord: "Signed" },
  { key: "welcomeEmailSent", label: "Welcome Email", doneWord: "Sent" },
  { key: "newHireInfo", label: "New Hire Info", doneWord: "Completed" },
  { key: "idPhoto", label: "ID Photo", doneWord: "Provided" },
  { key: "credentialsCreated", label: "Credentials", doneWord: "Created" },
  { key: "onboardingDay", label: "Onboarding Day", doneWord: "Confirmed" },
];

export type NotifyLine =
  | { type: "header"; text: string }
  | { type: "field"; text: string }
  | { type: "spacer" }
  | { type: "stepsHeader"; text: string }
  | { type: "step"; text: string }
  | { type: "sentBy"; text: string };

export function buildNotifyLines(hire: NewHire, sentBy: string): NotifyLine[] {
  const completedSteps = NOTIFY_STEPS.map((step, i) =>
    hire[step.key] ? `${i + 1}. ${step.label} - ${step.doneWord}` : null,
  ).filter((l): l is string => l !== null);

  const lines: NotifyLine[] = [
    { type: "header", text: `New Hire Update: ${hire.name || "Unnamed"}` },
    { type: "field", text: `Role: ${hire.roleTitle || "-"}` },
    { type: "field", text: `Start date: ${hire.startDate || "-"}` },
  ];
  if (hire.recruitmentLead)
    lines.push({ type: "field", text: `Recruitment Lead: ${hire.recruitmentLead}` });
  if (hire.onboardingSpecialist)
    lines.push({ type: "field", text: `Onboarding Specialist: ${hire.onboardingSpecialist}` });

  lines.push({ type: "spacer" });
  lines.push({
    type: "stepsHeader",
    text: completedSteps.length > 0 ? "Completed steps:" : "No checklist steps completed yet.",
  });
  for (const step of completedSteps) lines.push({ type: "step", text: step });
  lines.push({ type: "spacer" });
  lines.push({ type: "sentBy", text: `Sent by: ${sentBy}` });

  return lines;
}

export function buildNotifyText(lines: NotifyLine[]): string {
  return lines
    .map((line) => {
      switch (line.type) {
        case "header":
        case "sentBy":
          return `*${line.text}*`;
        case "spacer":
          return "";
        case "stepsHeader":
          return line.text.startsWith("Completed steps") ? `*${line.text}*` : line.text;
        case "step":
          return `✓ ${line.text}`;
        default:
          return line.text;
      }
    })
    .join("\n");
}
