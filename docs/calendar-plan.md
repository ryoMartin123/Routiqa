# Calendar Module — Implementation Plan

> Status: planning. No code yet. This document defines the architecture, data
> model, views, and build order for the Calendar / Dispatch module.

---

## 1. Core principle

**The calendar schedules Jobs, not Work Orders.**

| Concept | Owns | On the calendar? |
|---------|------|------------------|
| **Job** | scheduled date/time, duration, assigned technician/crew, location, service area | **Yes** — the schedulable event |
| **Work Order** | instructions, checklist, required photos, materials, completion notes | No — shown as a *summary inside the Job drawer* |

A Work Order never appears as its own calendar block. Its review status can surface
as a **Work Order Review** layer item (a task-like reminder), but the field work
itself is always represented by its parent Job.

---

## 2. The Calendar Item abstraction

The calendar renders many record types. Rather than force every module into one
table, we normalize them into a single **view-model** the UI consumes:

```ts
type CalendarItemType =
  | "job"
  | "sales_appointment"
  | "agreement_visit"
  | "task"
  | "project_milestone"
  | "work_order_review"
  | "internal_event"
  | "blocked_time"
  | "pto"
  | "training";

interface CalendarItem {
  id: string;
  type: CalendarItemType;
  title: string;

  // Scheduling
  start: string;            // ISO datetime
  end?: string;             // ISO datetime (or derive from durationMinutes)
  allDay?: boolean;
  durationMinutes?: number;

  // Assignment
  assignedTo?: string;      // technician/user name
  assignedToInitials?: string;
  crewId?: string;

  // Context (always present so the calendar can filter by selector)
  companyId: string;
  locationId: string;
  serviceAreaId?: string;

  // Linkage back to the source record
  sourceId: string;         // job id / task id / visit id / event id
  sourceModule: "jobs" | "tasks" | "agreements" | "projects" | "leads" | "calendar_events";

  // Display
  status?: string;
  color: string;            // resolved from type + status
  customerName?: string;
  address?: string;
}
```

### Where each item type comes from

| Item type | Source | Derived or native? |
|-----------|--------|--------------------|
| `job` | `lib/jobs/data.ts` — `scheduledDate` + `scheduledTime` + `durationMinutes` + `assignedTo` | **Derived** from existing Jobs |
| `agreement_visit` | `lib/agreements/data.ts` — `AgreementVisit.scheduled` + `tech` | **Derived** |
| `task` / follow-up | `lib/tasks/data.ts` — `dueDate` + `assignedTo` (all-day) | **Derived** |
| `project_milestone` | `lib/projects/data.ts` — project `targetDate` / task due dates | **Derived** |
| `sales_appointment` | `lib/leads/data.ts` — future lead appointment field | **Derived** (needs a lead appointment date field added later) |
| `work_order_review` | `lib/jobs/data.ts` WORK_ORDERS with `status: completed` awaiting review | **Derived** (all-day reminder) |
| `internal_event`, `blocked_time`, `pto`, `training` | **NEW** `calendar_events` table | **Native** — belong to no other module |

**Key decision:** Most calendar items are *derived* from records that already own
their scheduling. Only org-internal items (events, blocked time, PTO, training)
need a new backing table, because nothing else owns them.

---

## 3. New data the module needs

### `calendar_events` (new table — native items only)
```sql
calendar_events
  id, organization_id, company_id, location_id, service_area_id
  type:        internal_event | blocked_time | pto | training
  title, description
  start_at, end_at, all_day
  assigned_to            -- nullable (PTO/training target a user; events may be team-wide)
  created_by, created_at, updated_at
```

### Fields to ADD to existing tables (additive, later)
- `jobs`: nothing required for MVP — already has scheduled date/time, duration,
  assigned tech, location. (Future: `crew_id`, true ISO `scheduled_at`.)
- `leads`: `appointment_at` (for `sales_appointment` items) — Phase 2.

### Aggregator (new)
```
lib/calendar/data.ts      → getCalendarItems(range, scope, layers): CalendarItem[]
                            Pulls from jobs, tasks, agreements, projects,
                            calendar_events; normalizes to CalendarItem[].
lib/calendar/types.ts     → CalendarItem, CalendarItemType, layer + view enums,
                            color/label config.
lib/calendar/unscheduled.ts → getUnscheduledItems(scope): items needing a slot.
```

---

## 4. Layers (toggleable on/off)

The calendar overlays multiple layers; each can be shown/hidden via a legend:

- Jobs
- Sales Appointments
- Agreement Visits
- Tasks / Follow-Ups
- Project Milestones
- Work Order Review
- Internal Events
- PTO / Blocked Time

Each layer has a distinct color resolved from `CalendarItemType` (+ status for jobs,
reusing `JOB_STATUS_CONFIG`). Layer visibility persists per user (localStorage now,
user prefs later).

---

## 5. Views

| View | Description | MVP? |
|------|-------------|------|
| **Dispatch Board** | Rows = technicians/crews, columns = time slots for the selected day. Drag a job to a tech/time. | **MVP** |
| **Day** | Single-day timeline, all techs merged. | **MVP** |
| **Week** | 7-day grid. | **MVP** |
| **Month** | Month grid, items as chips. | Phase 2 |
| **Agenda** | Flat chronological list (great on mobile). | Phase 2 |
| **Technician View** | One tech's schedule. | Phase 2 |
| **Crew View** | One crew's schedule. | Phase 3 (needs crew model) |
| **Map View** | Pins by address. | Later (explicitly deferred) |
| **Unscheduled Queue** | Side panel, always available alongside any view. | **MVP** |

---

## 6. Unscheduled Queue

A persistent side panel (collapsible) listing work that needs a slot. Drag an item
onto the calendar/dispatch board to schedule it.

Sources:
- Approved **quotes** waiting to be turned into a scheduled job
- **Jobs** with no `scheduledDate` (or status `unscheduled`)
- **Agreement visits** due but not yet scheduled
- **Project phases** (jobs) not yet scheduled
- **Callbacks** waiting for an appointment
- **Tasks / follow-ups** flagged as needing scheduling

`getUnscheduledItems(scope)` aggregates these into the same `CalendarItem`-ish shape
(without `start`). Scheduling sets the date/time + assignment on the **source record**
(e.g. the Job), not on a calendar row — the calendar stays a *view* over real records.

---

## 7. Context behavior

The calendar respects the hierarchy selector exactly like every other module:

- Reads `effectiveCompanyId`, `effectiveLocationId`, `effectiveServiceAreaId` from
  `useHierarchy()`.
- `getCalendarItems()` and `getUnscheduledItems()` filter by those IDs.
- Viewing **Augusta Branch** → only Augusta-scheduled items + Augusta techs.
- Viewing **All Locations** → everything the user is authorized to see; the Dispatch
  Board groups technicians by location.

---

## 8. Click-through: Job detail drawer

Clicking any item opens a right-side **detail drawer** (same pattern as Photos/Customers):

For a **Job** item:
- Header: customer, job title, status, scheduled time, assigned tech
- **Work Order summary** tab/section inside the drawer: checklist progress,
  required-photo status, materials — read from `WORK_ORDERS[jobId]`
- Quick actions: reassign tech, reschedule, open full Job page
- Other item types show a lighter drawer appropriate to their source.

This reuses the existing job drawer concepts from `/jobs/[id]` rather than inventing
a new detail surface.

---

## 9. MVP scope (build first)

1. **Jobs on the calendar** — derive `CalendarItem`s from `ALL_JOBS`.
2. **Unscheduled Queue** — jobs without a scheduled slot + approved quotes.
3. **Assign technician / crew** — set `assignedTo` on the job from the calendar.
4. **Day / Week / Dispatch views** — three core views + the queue panel.
5. **Click job → detail drawer** with **Work Order summary** inside.
6. **Tasks / Follow-Ups layer** — derive all-day items from `ALL_TASKS`.
7. **Context-aware** throughout (hierarchy selector).
8. **Summary cards** above the calendar (consistent with other modules):
   Today's Jobs · Unscheduled · Techs On Duty · Hours Booked.

Explicitly **not** in MVP: GPS, route optimization, phone/calendar sync, crew
model, map view, drag-to-resize duration (start with drag-to-move + reassign).

---

## 10. Component breakdown

```
app/(dashboard)/calendar/page.tsx        → shell: header, summary cards, view
                                            switcher, context wiring, queue toggle
components/calendar/
  CalendarToolbar.tsx       → view switcher (Dispatch/Day/Week), date nav, layer legend
  DispatchBoard.tsx         → tech rows × time columns
  DayView.tsx               → single-day timeline
  WeekView.tsx              → 7-day grid
  UnscheduledQueue.tsx      → side panel + draggable items
  CalendarItemBlock.tsx     → a rendered item (color by type/status)
  CalendarItemDrawer.tsx    → detail drawer + Work Order summary
  LayerLegend.tsx           → toggle layers on/off
lib/calendar/
  types.ts                  → CalendarItem + enums + color/label config
  data.ts                   → getCalendarItems(range, scope, layers)
  unscheduled.ts            → getUnscheduledItems(scope)
  events.ts                 → mock calendar_events store (native items)
```

Drag-and-drop: reuse a lightweight approach (HTML5 DnD or a small library). Do **not**
pull in a heavy calendar library — keep the visual style consistent with the rest of
the CRM (CSS-variable theming, soft dark mode).

---

## 11. Build order

1. `lib/calendar/types.ts` + `data.ts` (jobs → CalendarItem) + summary cards.
2. Week view + Day view (read-only render of job items).
3. Detail drawer with Work Order summary.
4. Dispatch Board (tech rows).
5. Unscheduled Queue (read-only list).
6. Drag-to-schedule + reassign technician (writes to the Job).
7. Tasks/follow-ups layer + layer legend toggles.
8. `calendar_events` (internal events / PTO / blocked time).
9. Month / Agenda / Technician views (Phase 2).

---

## 12. What this is NOT (deferred)

- GPS tracking, route optimization, drive-time estimates
- Google/Outlook calendar sync, phone-system integration
- Crew model + Crew view (Phase 3)
- Map view
- Recurring internal events engine (start with single events)
- Auto-dispatch / AI scheduling suggestions (Phase 7 AI)
