import type { TaskLinkType, TaskPriority } from "../../generated/prisma/enums";
import type { TaskUrgency } from "./urgency";

/**
 * One row of system-computed work, read live from an Enquiry or EmailMessage - never stored (src/modules/tasks/derived-*.ts).
 * It disappears on its own once the underlying record changes; there is nothing to complete or dismiss here.
 */
export type DerivedTask = {
  id: string;
  kind: "derived.enquiry" | "derived.email";
  title: string;
  href: string;
  urgency: TaskUrgency;
  priority: TaskPriority;
  dueAt: Date | null;
  /** The timestamp urgency is computed from when there is no dueAt (an enquiry's lastActivityAt, an email's receivedAt). */
  anchorAt: Date;
  assignedTo: { id: string; name: string } | null;
  linkedType: TaskLinkType;
  linkedId: string;
};
