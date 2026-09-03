import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BarChart3, ScrollText, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { fetchCurrentAccount, signInWithZoho } from "@/lib/session";
import tgoLogoOnDark from "@/assets/tgo-logo-ondark.png";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign In — TGO Workforce" },
      {
        name: "description",
        content: "Sign in to the TGO Workforce portal with your Zoho account.",
      },
      { property: "og:title", content: "Sign In — TGO Workforce" },
    ],
  }),
  component: LoginPage,
});

// Mirrors the real navigation (Directory, Analytics, Activity Logs) so the pitch
// on this screen matches what's actually in the product.
const HIGHLIGHTS = [
  { icon: Users, label: "Manage your directory, hires and exits in one place" },
  { icon: BarChart3, label: "Visual analytics on headcount and tenure" },
  { icon: ScrollText, label: "Full audit trail on every record change" },
];

function LoginPage() {
  const navigate = useNavigate();

  // Already signed in — no reason to show the login screen.
  useEffect(() => {
    let cancelled = false;
    fetchCurrentAccount().then((profile) => {
      if (!cancelled && profile) {
        navigate({ to: "/" });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  // Surfaces why we're back on this screen after a round trip to Zoho that
  // didn't end in a session — see backend/app/api/routes/auth.py, which
  // appends ?error=... to this redirect for each failure case.
  useEffect(() => {
    const error = new URLSearchParams(window.location.search).get("error");
    if (error === "inactive") {
      toast.error("Your account isn't active yet. Contact your admin.");
    } else if (error === "zoho") {
      toast.error("Zoho sign-in didn't go through. Please try again.");
    }
  }, []);

  function handleZohoSignIn() {
    signInWithZoho();
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-muted/30 p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background: "radial-gradient(600px circle at 50% 35%, var(--primary), transparent 60%)",
          opacity: 0.06,
        }}
      />
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="relative grid w-full max-w-3xl overflow-hidden rounded-3xl border bg-card shadow-2xl sm:grid-cols-2">
        {/* Sign-in panel */}
        <div className="flex flex-col justify-center px-8 py-12 sm:px-10">
          <div className="mx-auto w-full max-w-xs">
            <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in to your TGO Workforce account
            </p>
            <Button
              className="mt-6 w-full shadow-sm transition-shadow hover:shadow-md"
              size="lg"
              onClick={handleZohoSignIn}
            >
              Continue with Zoho
            </Button>
            <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
              Access is limited to People Ops and Hub Leads. Contact your admin if you can't sign
              in.
            </p>
          </div>
        </div>

        {/* Decorative panel — fixed dark colors, not theme tokens */}
        <div className="relative hidden flex-col justify-center gap-8 bg-[#0f2a3d] px-10 py-12 sm:flex">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.12) 1px, transparent 0)",
              backgroundSize: "20px 20px",
            }}
          />
          <img
            src={tgoLogoOnDark}
            alt="Torero Global Outsourcing"
            className="relative h-16 w-auto object-contain"
          />
          <div className="relative">
            <p className="text-[11px] font-medium uppercase tracking-widest text-white/40">
              Workforce Operations
            </p>
            <h2 className="mt-1 text-xl font-semibold text-white">TGO Workforce</h2>
            <p className="mt-1 max-w-[240px] text-sm text-white/60">
              For TGO's People Operations team
            </p>
          </div>
          <ul className="relative flex w-full flex-col gap-3">
            {HIGHLIGHTS.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex items-start gap-2.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/80"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[#8bc47f]/15">
                  <Icon className="size-4 text-[#8bc47f]" />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
