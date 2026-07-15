import { useGetClientTimeline, getGetClientTimelineQueryKey } from "@workspace/api-client-react";
import type { TimelineEvent } from "@workspace/api-client-react";
import { format, isToday, isYesterday, differenceInDays, startOfDay } from "date-fns";
import {
  Building2,
  FolderKanban,
  DollarSign,
  FileText,
  Users,
  StickyNote,
  CheckSquare,
  ListTodo,
  Activity,
  Zap,
  Clock,
} from "lucide-react";

// ── Event metadata ────────────────────────────────────────────────────────────

interface EventMeta {
  icon: React.ElementType;
  iconColor: string;
  ringColor: string;
  bgColor: string;
  label: string;
}

function getEventMeta(type: string): EventMeta {
  if (type.startsWith("client_")) {
    return {
      icon: Building2,
      iconColor: "text-blue-400",
      ringColor: "ring-blue-500/30",
      bgColor: "bg-blue-500/10",
      label: "Client",
    };
  }
  if (type.startsWith("project_")) {
    return {
      icon: FolderKanban,
      iconColor: "text-violet-400",
      ringColor: "ring-violet-500/30",
      bgColor: "bg-violet-500/10",
      label: "Project",
    };
  }
  if (type.startsWith("payment_") || type.startsWith("invoice_")) {
    return {
      icon: DollarSign,
      iconColor: "text-emerald-400",
      ringColor: "ring-emerald-500/30",
      bgColor: "bg-emerald-500/10",
      label: "Payment",
    };
  }
  if (type.startsWith("document_")) {
    return {
      icon: FileText,
      iconColor: "text-amber-400",
      ringColor: "ring-amber-500/30",
      bgColor: "bg-amber-500/10",
      label: "Document",
    };
  }
  if (type.startsWith("meeting_")) {
    return {
      icon: Users,
      iconColor: "text-cyan-400",
      ringColor: "ring-cyan-500/30",
      bgColor: "bg-cyan-500/10",
      label: "Meeting",
    };
  }
  if (type.startsWith("note_")) {
    return {
      icon: StickyNote,
      iconColor: "text-orange-400",
      ringColor: "ring-orange-500/30",
      bgColor: "bg-orange-500/10",
      label: "Note",
    };
  }
  if (type.startsWith("deliverable_")) {
    return {
      icon: CheckSquare,
      iconColor: "text-teal-400",
      ringColor: "ring-teal-500/30",
      bgColor: "bg-teal-500/10",
      label: "Deliverable",
    };
  }
  if (type.startsWith("task_")) {
    return {
      icon: ListTodo,
      iconColor: "text-indigo-400",
      ringColor: "ring-indigo-500/30",
      bgColor: "bg-indigo-500/10",
      label: "Task",
    };
  }
  return {
    icon: Zap,
    iconColor: "text-muted-foreground",
    ringColor: "ring-border",
    bgColor: "bg-secondary",
    label: "Event",
  };
}

// ── Date grouping ─────────────────────────────────────────────────────────────

function getDateLabel(date: Date): string {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  const diff = differenceInDays(startOfDay(new Date()), startOfDay(date));
  if (diff < 7) return format(date, "EEEE"); // "Monday"
  if (diff < 365) return format(date, "MMMM d");
  return format(date, "MMMM d, yyyy");
}

function groupEventsByDate(events: TimelineEvent[]): [string, TimelineEvent[]][] {
  const groups = new Map<string, TimelineEvent[]>();
  for (const event of events) {
    const date = new Date(event.occurredAt);
    const label = getDateLabel(date);
    const existing = groups.get(label);
    if (existing) {
      existing.push(event);
    } else {
      groups.set(label, [event]);
    }
  }
  return Array.from(groups.entries());
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function HistorySkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {[3, 2, 4].map((count, gi) => (
        <div key={gi} className="space-y-3">
          <div className="h-3 w-16 bg-secondary rounded-full" />
          <div className="space-y-4 pl-2">
            {Array.from({ length: count }).map((_, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="w-8 h-8 rounded-full bg-secondary shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1.5 pt-1">
                  <div className="h-3 bg-secondary rounded-full w-3/4" />
                  <div className="h-2.5 bg-secondary/60 rounded-full w-1/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyHistory() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-full bg-secondary/60 flex items-center justify-center mb-4">
        <Clock size={24} className="text-muted-foreground/60" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">No history yet</p>
      <p className="text-xs text-muted-foreground/60 mt-1 max-w-48">
        Activity will appear here as you add projects, invoices, and documents.
      </p>
    </div>
  );
}

// ── Single event row ──────────────────────────────────────────────────────────

function EventRow({ event, isLast }: { event: TimelineEvent; isLast: boolean }) {
  const meta = getEventMeta(event.type);
  const Icon = meta.icon;
  const date = new Date(event.occurredAt);

  return (
    <div className="flex gap-4 items-start group">
      {/* Spine */}
      <div className="flex flex-col items-center shrink-0">
        <div
          className={`w-8 h-8 rounded-full ring-1 ${meta.ringColor} ${meta.bgColor} flex items-center justify-center shrink-0 transition-transform group-hover:scale-110`}
        >
          <Icon size={14} className={meta.iconColor} />
        </div>
        {!isLast && <div className="w-px flex-1 min-h-[24px] bg-border/50 mt-1" />}
      </div>

      {/* Content */}
      <div className="flex-1 pb-6 min-w-0">
        <p className="text-sm text-foreground leading-snug">{event.description}</p>
        <div className="flex items-center gap-2 mt-1">
          <span
            className={`text-[10px] font-medium uppercase tracking-wide ${meta.iconColor} opacity-80`}
          >
            {meta.label}
          </span>
          <span className="text-muted-foreground/40 text-[10px]">·</span>
          <time
            dateTime={event.occurredAt}
            className="text-xs text-muted-foreground/60"
            title={format(date, "PPpp")}
          >
            {format(date, "h:mm a")}
          </time>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ClientHistory({ clientId }: { clientId: number }) {
  const { data: events, isLoading } = useGetClientTimeline(clientId, {
    query: { enabled: !!clientId, queryKey: getGetClientTimelineQueryKey(clientId) },
  });

  if (isLoading) return <HistorySkeleton />;
  if (!events || events.length === 0) return <EmptyHistory />;

  const groups = groupEventsByDate(events);

  return (
    <div className="space-y-8">
      {/* Summary pill */}
      <div className="flex items-center gap-2">
        <Activity size={14} className="text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          {events.length} event{events.length !== 1 ? "s" : ""} recorded
        </span>
      </div>

      {/* Timeline groups */}
      {groups.map(([label, groupEvents]) => (
        <div key={label} className="space-y-0">
          {/* Date separator */}
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px flex-1 bg-border/40" />
            <span className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest shrink-0">
              {label}
            </span>
            <div className="h-px flex-1 bg-border/40" />
          </div>

          {/* Events in this group */}
          <div className="pl-1">
            {groupEvents.map((event, i) => (
              <EventRow
                key={event.id}
                event={event}
                isLast={i === groupEvents.length - 1}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
