// Add HMO Member — SOP section 4's sectioned form (Employee Information /
// Membership Information / HMO Coverage / Payment Information), split into
// visual sections instead of one long table, per the doc's own instruction.
// Employee picking reuses AwardFormDialog's exact searchable-combobox-with-
// office/department/position-filters pattern (@/components/award-form-dialog)
// against useEmployees(), restricted to Active employees, auto-filling
// department/hire date. A Dependent row instead picks an existing Principal
// HmoMember to link under.
//
// Only the fields collected here at creation time are on HmoMemberInput —
// every other lifecycle field (enrollment status, card status, removal)
// starts at its schema default and gets filled in later via the member
// detail page's status editors (updateHmoMember/PATCH), not this form.
import { useEffect, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  HMO_ENROLLMENT_STATUSES,
  HMO_INCLUSION_OPTIONS,
  HMO_MBL_OPTIONS,
  HMO_MEMBER_STATUSES,
  HMO_RANK_OPTIONS,
  HMO_RELATIONSHIPS,
  HMO_ROOM_AND_BOARD_OPTIONS,
  type HmoEnrollmentStatus,
  type HmoMember,
  type HmoMemberStatus,
  type HmoMemberType,
  type HmoRelationship,
} from "@/data/hmo-api";
import { useCreateHmoMember } from "@/data/hmo-store";
import { useEmployees } from "@/data/employee-store";
import { cn } from "@/lib/utils";

const ALL = "all";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function distinctSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

export function HmoMemberFormDialog({
  open,
  onOpenChange,
  principals,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing Principal members, for the Dependent picker. */
  principals: HmoMember[];
}) {
  const employees = useEmployees();
  const activeEmployees = employees
    .filter((e) => e.status === "Active")
    .sort((a, b) => a.name.localeCompare(b.name));

  const [memberType, setMemberType] = useState<HmoMemberType>("Principal");

  const [employeeId, setEmployeeId] = useState("");
  const selectedEmployee = activeEmployees.find((e) => e.id === employeeId);
  const [employeePickerOpen, setEmployeePickerOpen] = useState(false);
  const [officeFilter, setOfficeFilter] = useState(ALL);
  const [departmentFilter, setDepartmentFilter] = useState(ALL);
  const officeOptions = distinctSorted(activeEmployees.map((e) => e.office));
  const departmentOptions = distinctSorted(activeEmployees.map((e) => e.department));
  const filteredEmployees = activeEmployees.filter(
    (e) =>
      (officeFilter === ALL || e.office === officeFilter) &&
      (departmentFilter === ALL || e.department === departmentFilter),
  );

  const [principalId, setPrincipalId] = useState("");
  const [principalPickerOpen, setPrincipalPickerOpen] = useState(false);
  const selectedPrincipal = principals.find((p) => p.id === principalId);
  const [relationship, setRelationship] = useState<HmoRelationship>("Spouse");
  const [dependentName, setDependentName] = useState("");
  const [birthday, setBirthday] = useState("");

  const [hireDate, setHireDate] = useState("");
  const [eligibilityDate, setEligibilityDate] = useState("");
  const [hmoCardNumber, setHmoCardNumber] = useState("");
  const [rank, setRank] = useState("");
  const [roomAndBoard, setRoomAndBoard] = useState("");
  const [mbl, setMbl] = useState("");
  const [dental, setDental] = useState("");
  const [ape, setApe] = useState("");
  const [monthlyPremium, setMonthlyPremium] = useState("");
  const [biweeklyDeduction, setBiweeklyDeduction] = useState("");
  // Default to the same values the backend would apply on its own, so leaving
  // them untouched books the member in at the very start of the workflow.
  const [enrollmentStatus, setEnrollmentStatus] = useState<HmoEnrollmentStatus>("Not Eligible");
  const [memberStatus, setMemberStatus] = useState<HmoMemberStatus>("Not Yet Active");

  const createMutation = useCreateHmoMember();

  useEffect(() => {
    if (!open) return;
    setMemberType("Principal");
    setEmployeeId("");
    setOfficeFilter(ALL);
    setDepartmentFilter(ALL);
    setPrincipalId("");
    setRelationship("Spouse");
    setDependentName("");
    setBirthday("");
    setHireDate("");
    setEligibilityDate("");
    setHmoCardNumber("");
    setRank("");
    setRoomAndBoard("");
    setMbl("");
    setDental("");
    setApe("");
    setMonthlyPremium("");
    setBiweeklyDeduction("");
    setEnrollmentStatus("Not Eligible");
    setMemberStatus("Not Yet Active");
  }, [open]);

  useEffect(() => {
    if (selectedEmployee) setHireDate((prev) => prev || selectedEmployee.startDate);
  }, [selectedEmployee]);

  async function handleSubmit() {
    if (memberType === "Principal" && !employeeId) {
      toast.error("Choose which employee this membership is for.");
      return;
    }
    if (memberType === "Dependent") {
      if (!principalId) {
        toast.error("Choose the principal member this dependent belongs to.");
        return;
      }
      if (!dependentName.trim()) {
        toast.error("Enter the dependent's full name.");
        return;
      }
    }

    try {
      await createMutation.mutateAsync({
        memberType,
        ...(memberType === "Principal" ? { employeeId } : {}),
        ...(memberType === "Dependent"
          ? {
              principalMemberId: principalId,
              relationshipToPrincipal: relationship,
              dependentName: dependentName.trim(),
            }
          : {}),
        ...(birthday ? { birthday } : {}),
        ...(hireDate ? { hireDate } : {}),
        ...(eligibilityDate ? { eligibilityDate } : {}),
        ...(hmoCardNumber.trim() ? { hmoCardNumber: hmoCardNumber.trim() } : {}),
        ...(rank ? { rank } : {}),
        ...(roomAndBoard ? { roomAndBoard } : {}),
        ...(mbl ? { mbl } : {}),
        ...(dental ? { dental } : {}),
        ...(ape ? { ape } : {}),
        ...(monthlyPremium ? { monthlyPremium: Number(monthlyPremium) } : {}),
        ...(biweeklyDeduction ? { biweeklyDeduction: Number(biweeklyDeduction) } : {}),
        enrollmentStatus,
        memberStatus,
      });
      toast.success("HMO member added");
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Couldn't add this HMO member. Please try again.",
      );
    }
  }

  const busy = createMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] w-[95vw] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add HMO Member</DialogTitle>
          <DialogDescription>
            Add an employee (Principal) or a dependent tied to an existing member.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <div className="grid gap-2">
            <Label>Member Type</Label>
            <Select value={memberType} onValueChange={(v) => setMemberType(v as HmoMemberType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Principal">Principal (Employee)</SelectItem>
                <SelectItem value="Dependent">Dependent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {memberType === "Principal" ? (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-primary">Employee Information</h3>
              <div className="grid gap-2">
                <Label>Employee</Label>
                <Popover open={employeePickerOpen} onOpenChange={setEmployeePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={employeePickerOpen}
                      className="w-full justify-between font-normal"
                    >
                      <span className="min-w-0 truncate">
                        {selectedEmployee
                          ? `${selectedEmployee.name} · ${selectedEmployee.office}`
                          : "Search for an active employee..."}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[460px] max-w-[90vw] p-0" align="start">
                    <div className="flex flex-wrap gap-1.5 border-b p-2">
                      <Select value={officeFilter} onValueChange={setOfficeFilter}>
                        <SelectTrigger className="h-7 flex-1 text-xs">
                          <SelectValue placeholder="Office" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ALL}>All offices</SelectItem>
                          {officeOptions.map((o) => (
                            <SelectItem key={o} value={o}>
                              {o}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                        <SelectTrigger className="h-7 flex-1 text-xs">
                          <SelectValue placeholder="Department" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ALL}>All departments</SelectItem>
                          {departmentOptions.map((d) => (
                            <SelectItem key={d} value={d}>
                              {d}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Command>
                      <CommandInput placeholder="Search by name, office or department..." />
                      <CommandList>
                        <CommandEmpty>No active employees match.</CommandEmpty>
                        <CommandGroup>
                          {filteredEmployees.map((e) => (
                            <CommandItem
                              key={e.id}
                              value={`${e.name} ${e.office} ${e.department} ${e.id}`}
                              onSelect={() => {
                                setEmployeeId(e.id);
                                setEmployeePickerOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mt-0.5 h-4 w-4 shrink-0",
                                  employeeId === e.id ? "opacity-100" : "opacity-0",
                                )}
                              />
                              <div className="min-w-0">
                                <p className="truncate">{e.name}</p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {e.office} · {e.department}
                                </p>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="hmo-hire-date">Hire Date</Label>
                  <Input
                    id="hmo-hire-date"
                    type="date"
                    value={hireDate}
                    onChange={(e) => setHireDate(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="hmo-eligibility-date">HMO Eligibility Date</Label>
                  <Input
                    id="hmo-eligibility-date"
                    type="date"
                    value={eligibilityDate}
                    onChange={(e) => setEligibilityDate(e.target.value)}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-primary">Membership Information</h3>
              <div className="grid gap-2">
                <Label>Principal Member</Label>
                <Popover open={principalPickerOpen} onOpenChange={setPrincipalPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={principalPickerOpen}
                      className="w-full justify-between font-normal"
                    >
                      <span className="min-w-0 truncate">
                        {selectedPrincipal
                          ? `${selectedPrincipal.employeeName} · ${selectedPrincipal.department}`
                          : "Search for a principal member..."}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[460px] max-w-[90vw] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search by employee name..." />
                      <CommandList>
                        <CommandEmpty>No principal members match.</CommandEmpty>
                        <CommandGroup>
                          {principals.map((p) => (
                            <CommandItem
                              key={p.id}
                              value={`${p.employeeName} ${p.department}`}
                              onSelect={() => {
                                setPrincipalId(p.id);
                                setPrincipalPickerOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mt-0.5 h-4 w-4 shrink-0",
                                  principalId === p.id ? "opacity-100" : "opacity-0",
                                )}
                              />
                              <div className="min-w-0">
                                <p className="truncate">{p.employeeName}</p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {p.department}
                                </p>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="hmo-dependent-name">Full Name</Label>
                  <Input
                    id="hmo-dependent-name"
                    value={dependentName}
                    onChange={(e) => setDependentName(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Relationship</Label>
                  <Select
                    value={relationship}
                    onValueChange={(v) => setRelationship(v as HmoRelationship)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HMO_RELATIONSHIPS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="hmo-dependent-birthday">Birthday</Label>
                  <Input
                    id="hmo-dependent-birthday"
                    type="date"
                    value={birthday}
                    onChange={(e) => setBirthday(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-primary">HMO Coverage</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="hmo-card-number">HMO Card No. (optional)</Label>
                <Input
                  id="hmo-card-number"
                  value={hmoCardNumber}
                  onChange={(e) => setHmoCardNumber(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Rank</Label>
                <Select value={rank} onValueChange={setRank}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select rank" />
                  </SelectTrigger>
                  <SelectContent>
                    {HMO_RANK_OPTIONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Room & Board</Label>
                <Select value={roomAndBoard} onValueChange={setRoomAndBoard}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select room & board" />
                  </SelectTrigger>
                  <SelectContent>
                    {HMO_ROOM_AND_BOARD_OPTIONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>MBL</Label>
                <Select value={mbl} onValueChange={setMbl}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select MBL" />
                  </SelectTrigger>
                  <SelectContent>
                    {HMO_MBL_OPTIONS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Dental</Label>
                <Select value={dental} onValueChange={setDental}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select dental coverage" />
                  </SelectTrigger>
                  <SelectContent>
                    {HMO_INCLUSION_OPTIONS.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>APE</Label>
                <Select value={ape} onValueChange={setApe}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select APE coverage" />
                  </SelectTrigger>
                  <SelectContent>
                    {HMO_INCLUSION_OPTIONS.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-primary">Payment Information</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="hmo-monthly-premium">Monthly Premium (optional)</Label>
                <Input
                  id="hmo-monthly-premium"
                  type="number"
                  min="0"
                  step="0.01"
                  value={monthlyPremium}
                  onChange={(e) => setMonthlyPremium(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="hmo-biweekly-deduction">Bi-Weekly Deduction (optional)</Label>
                <Input
                  id="hmo-biweekly-deduction"
                  type="number"
                  min="0"
                  step="0.01"
                  value={biweeklyDeduction}
                  onChange={(e) => setBiweeklyDeduction(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Two separate fields on purpose, per the SOP: Enrollment Status is
              where they are in the workflow, Member Status is whether the
              membership is usable right now. */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-primary">Enrollment & Status</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Enrollment Status</Label>
                <Select
                  value={enrollmentStatus}
                  onValueChange={(v) => setEnrollmentStatus(v as HmoEnrollmentStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HMO_ENROLLMENT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Member Status</Label>
                <Select
                  value={memberStatus}
                  onValueChange={(v) => setMemberStatus(v as HmoMemberStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HMO_MEMBER_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={busy}>
            {busy ? "Adding..." : "Add HMO Member"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
