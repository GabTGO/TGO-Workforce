// Not real security — a lightweight gate so casual visitors don't stumble
// into bulk-edit or delete tools. Swap for a real per-account check (e.g. a
// re-auth prompt) once the app has actual user-owned credentials to check
// against — right now sign-in is Zoho SSO only, so there's no password on
// file for any individual account.
//
// Shared by ManageEmployeesDialog (unlocking the manage screen, and now
// confirming a single delete) and EmployeeTable (confirming a checkbox
// bulk-delete) so the one value lives in one place instead of drifting.
export const MANAGE_PASSWORD = "Gemma";
