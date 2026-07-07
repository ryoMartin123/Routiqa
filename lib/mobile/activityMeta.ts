// Shared mapping: activity event type → mobile icon + accent color + label.
// Used by the overview activity scroll and the notifications popup.

import {
  Briefcase, UserPlus, FileText, Receipt, FileCheck2, Image as ImageIcon,
  StickyNote, Mail, MessageSquare, Phone, CheckSquare, Users,
} from "lucide-react";

export function activityMeta(type: string): { icon: React.ElementType; color: string } {
  if (type.startsWith("job") || type.startsWith("work_order")) return { icon: Briefcase, color: "#239c8d" };
  if (type.startsWith("lead")) return { icon: UserPlus, color: "#f59e0b" };
  if (type.startsWith("quote")) return { icon: FileText, color: "#8b5cf6" };
  if (type.startsWith("invoice") || type.startsWith("payment")) return { icon: Receipt, color: "#10b981" };
  if (type.startsWith("agreement")) return { icon: FileCheck2, color: "#0891b2" };
  if (type.startsWith("photo") || type.startsWith("file")) return { icon: ImageIcon, color: "#3b82f6" };
  if (type.startsWith("note")) return { icon: StickyNote, color: "#6b7280" };
  if (type.startsWith("email")) return { icon: Mail, color: "#3b82f6" };
  if (type.startsWith("sms")) return { icon: MessageSquare, color: "#3b82f6" };
  if (type.startsWith("call")) return { icon: Phone, color: "#10b981" };
  if (type.startsWith("task")) return { icon: CheckSquare, color: "#f59e0b" };
  return { icon: Users, color: "#239c8d" };
}

export const activityLabel = (type: string) =>
  type.replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase());
