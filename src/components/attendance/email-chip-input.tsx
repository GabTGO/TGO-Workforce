import { useMemo, useRef, useState } from "react";
import { Mail, X } from "lucide-react";

import { cn } from "@/lib/utils";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function parseAddresses(value: string): string[] {
  return value
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);
}

/**
 * A "type or paste an email, get a removable bubble" input for multi-recipient
 * fields (violation Cc addresses) — ported from the standalone attendance
 * app's src/components/email-chip-input.tsx.
 *
 * Deviation from the source: the source app backed this with a "GET /roster"
 * teammate picker (search-and-click instead of typing an address). This app
 * has no equivalent open-to-every-signed-in-role roster endpoint — the
 * closest, GET /accounts, is admin-only (see backend/app/core/auth.py's
 * require_admin) and listing every account to any Attendance writer would be
 * a real access-control change outside this port's scope, so that lookup was
 * dropped rather than routed around. Enter or comma still commits a raw,
 * validated email address as a chip; a future session can wire a proper
 * lookup back in once there's a role-appropriate roster endpoint.
 *
 * The value/onChange contract stays a plain comma-separated string, matching
 * ViolationUpdateInput's ccAddresses field with no backend or
 * parent-component changes needed.
 */
export function EmailChipInput({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [inputValue, setInputValue] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addresses = useMemo(() => parseAddresses(value), [value]);
  const addressSet = useMemo(() => new Set(addresses.map((a) => a.toLowerCase())), [addresses]);

  const addAddress = (raw: string) => {
    const address = raw.trim();
    if (!address) return;
    if (!EMAIL_RE.test(address)) return;
    if (addressSet.has(address.toLowerCase())) {
      setInputValue("");
      return;
    }
    onChange([...addresses, address].join(", "));
    setInputValue("");
  };

  const removeAddress = (address: string) => {
    onChange(addresses.filter((a) => a.toLowerCase() !== address.toLowerCase()).join(", "));
  };

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-2 py-1.5 text-sm shadow-sm",
        focused && "ring-1 ring-ring",
        disabled && "opacity-60",
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {addresses.map((address) => (
        <span
          key={address}
          className="flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 py-0.5 pl-1.5 pr-1 text-xs text-primary"
        >
          <Mail className="size-3" />
          <span title={address}>{address}</span>
          {!disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeAddress(address);
              }}
              className="rounded-full p-0.5 hover:bg-primary/20"
              aria-label={`Remove ${address}`}
            >
              <X className="size-3" />
            </button>
          )}
        </span>
      ))}

      <input
        ref={inputRef}
        disabled={disabled}
        value={inputValue}
        placeholder={addresses.length === 0 ? placeholder : "Add another…"}
        onChange={(e) => setInputValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          if (inputValue.trim()) addAddress(inputValue);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            addAddress(inputValue);
          } else if (e.key === "Backspace" && inputValue === "" && addresses.length > 0) {
            removeAddress(addresses[addresses.length - 1]!);
          }
        }}
        className="min-w-[10rem] flex-1 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
