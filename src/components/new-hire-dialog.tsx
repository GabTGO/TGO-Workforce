import { useState } from "react";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OFFICES } from "@/data/employees";

const SOURCE_TYPES = [
  "Direct Applicant",
  "Referral",
  "Rehire",
  "Internal Transfer",
] as const;

export function NewHireDialog() {
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [startDate, setStartDate] = useState("");
  const [office, setOffice] = useState("");
  const [sourceType, setSourceType] = useState("");

  const fullName = [firstName, lastName].filter(Boolean).join(" ");

  function reset() {
    setFirstName("");
    setLastName("");
    setBirthday("");
    setStartDate("");
    setOffice("");
    setSourceType("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="mr-2 h-4 w-4" /> New Hire Form
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] w-[95vw] overflow-y-auto sm:max-w-2xl">
        <div className="pb-2">
          <h2 className="text-lg font-semibold">New Hire Employee Information Form</h2>
          <p className="text-sm text-muted-foreground">
            Submit onboarding details. Records sync to the directory on approval.
          </p>
        </div>

        <div className="space-y-6 py-2">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-primary">Basic Information</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="nh-first-name">First Name</Label>
                <Input
                  id="nh-first-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="nh-last-name">Last Name</Label>
                <Input
                  id="nh-last-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="nh-birthday">Birthday</Label>
                <Input
                  id="nh-birthday"
                  type="date"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="nh-start">Start Date</Label>
                <Input
                  id="nh-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-primary">Employment Information</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Office</Label>
                <Select value={office} onValueChange={setOffice}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Office" />
                  </SelectTrigger>
                  <SelectContent>
                    {OFFICES.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Source Type</Label>
                <Select value={sourceType} onValueChange={setSourceType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Source Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_TYPES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Department and position assignment are handled internally after onboarding.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setOpen(false);
              toast.success(`New hire submitted${fullName ? `: ${fullName}` : ""}`);
              reset();
            }}
          >
            Submit New Hire Form
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
