import { redirect } from "next/navigation";

// The Calendar module was renamed to Dispatching. This stub preserves the old
// /calendar URL (bookmarks, existing tabs) by redirecting to the new route.
export default function CalendarRedirect() {
  redirect("/dispatching");
}
