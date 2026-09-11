// A checkbox-driven filter dropdown that allows several values at once (e.g.
// Active + Terminated together) — unlike FilterSelect (single choice via a
// native-style Select), this is for filters where "more than one at a time"
// is a real use case. An empty `selected` array means "no filter" (matches
// everything), same convention FilterSelect's "all" sentinel uses, just
// expressed as an array instead of a string.

import { Check, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const triggerLabel =
    selected.length === 0
      ? `All ${label.toLowerCase()}`
      : selected.length === 1
        ? selected[0]
        : `${label} (${selected.length})`;

  function toggle(option: string, checked: boolean) {
    onChange(checked ? [...selected, option] : selected.filter((s) => s !== option));
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-[170px] justify-between font-normal text-muted-foreground data-[has-selection=true]:text-foreground"
          data-has-selection={selected.length > 0}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="flex items-center justify-between px-1 pb-1.5">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          {selected.length > 0 && (
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => onChange([])}
            >
              Clear
            </button>
          )}
        </div>
        <div className="max-h-60 space-y-0.5 overflow-y-auto">
          {options.map((option) => {
            const checked = selected.includes(option);
            return (
              <label
                key={option}
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(c) => toggle(option, c === true)}
                />
                <span className="flex-1">{option}</span>
                {checked && <Check className="h-3.5 w-3.5 text-primary" />}
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
