// Shared filter dropdown — used by the Employee Directory table and the New
// Hires table so both filter bars look and behave identically instead of
// drifting into two slightly different implementations.

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function FilterSelect({
  value,
  onChange,
  placeholder,
  allLabel,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  allLabel: string;
  options: string[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[170px]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
