import { useState } from "react";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEPARTMENTS, OFFICES } from "@/data/employees";

export function NewHireDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="mr-2 h-4 w-4" /> New Hire Form
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New hire intake</DialogTitle>
          <DialogDescription>
            Submit onboarding details. Records sync to the directory on approval.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="nh-name">Full name</Label>
            <Input
              id="nh-name"
              placeholder="Jane Dela Rosa"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Office</Label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Select office" />
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
            <Label>Department</Label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="nh-position">Position</Label>
            <Input id="nh-position" placeholder="Automation Analyst" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="nh-start">Start date</Label>
            <Input id="nh-start" type="date" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setOpen(false);
              toast.success(`New hire submitted${name ? `: ${name}` : ""}`);
              setName("");
            }}
          >
            Submit new hire
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
