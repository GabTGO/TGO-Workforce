// Backs the "send via Outlook" alternate path for Attendance Violations (see
// backend/app/models/app_settings.py's use_outlook_for_violations) — builds a
// mailto: link from a violation email's rendered preview and hands it off to
// whatever the browser/OS has registered as the mail client (MS Outlook, in
// practice, since that's who this was built for).
//
// Two things a mailto: link genuinely cannot do, worth knowing before relying
// on this:
//   - There's no standard "from" parameter. Outlook sends from whichever
//     account is currently selected as default in the compose window — the
//     "From" override captured in the UI here is still saved on the record
//     (for audit/record-keeping and for the next time this record's email is
//     previewed), but it can't force which mailbox Outlook actually sends
//     from. The UI must tell the person that explicitly rather than implying
//     it "just works."
//   - The body must be plain text (mailto has no HTML body concept) — see
//     htmlToPlainText below, which converts the violation email template's
//     simple HTML (labeled lines, <br>, <p>) into readable plain text.

/** Converts the violation email template's HTML (see
 * backend/app/services/violation_email_template.py's build_body — bold
 * labels, <br> line breaks, <p> paragraphs, one <a> signature link) into
 * plain text suitable for a mailto: body. Good enough for this one template,
 * not a general-purpose HTML-to-text converter. */
export function htmlToPlainText(html: string): string {
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n");

  // DOM-based tag stripping + entity decoding (&amp;, &nbsp;, etc.) — more
  // reliable than a regex for anything with escaped entities in it.
  const container = document.createElement("div");
  container.innerHTML = withBreaks;
  const text = container.textContent ?? "";

  return text
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function buildMailtoUrl(options: {
  to: string;
  cc?: string | null;
  subject: string;
  body: string;
}): string {
  const params = new URLSearchParams();
  if (options.cc) params.set("cc", options.cc);
  params.set("subject", options.subject);
  params.set("body", options.body);
  // The "to" address sits before the "?" in a mailto: URI, not inside the
  // query string — it must stay a literal, unencoded address ("a@b.com").
  // Running it through encodeURIComponent turns "@" into "%40", and
  // whatever mailto: handler is registered here doesn't decode that back
  // into a real "@" before handing off to Outlook, so the To field showed
  // up empty even though everything else (Cc, subject, body — all real
  // query params) came through fine.
  //
  // URLSearchParams encodes spaces as "+", which most mail clients (Outlook
  // included) don't decode back in a mailto: context — encode them as %20
  // instead, matching how a real mailto: URI should escape a body/subject.
  return `mailto:${options.to}?${params.toString().replace(/\+/g, "%20")}`;
}

/** Hands the mailto: URI to the OS/browser's registered mail client. Uses a
 * throwaway anchor + click() rather than `window.location.href = url` so
 * this never navigates the app away from itself if no mail client is
 * registered to handle it (some browsers show an error page in that case
 * for a direct location change, but not for an anchor click). */
export function openMailto(url: string): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}
