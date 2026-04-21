import * as storage from "@/storage.ts";
import { Memo, Session } from "@/utils.ts";

export interface SessionsByDay {
    date: number; // ms since epoch, local midnight
    millis: number;
}

export interface EnrichedSession extends Session {
    startFormatted: string;
    endFormatted: string | null;
}

interface LogData {
    project: {
        id: string;
        name: string;
        rate: number;
        advance: number;
    };
    sessions: EnrichedSession[];
    time: number;
    ongoingTime: number;
    currency: string;
    currentSession?: EnrichedSession;
    elapsed: number;
    decimalHours: number;
    gross: number;
    advanceRemaining: number;
    finalAmount: number;
    hoursExpr: string;
    memos: Memo[];
    totalExpenses: number;
    finalWithExpenses: number;
    sessionsByDay: SessionsByDay[];
    invoiceDate: string;
    dueDate: string;
}

const MS_PER_DAY = 86_400_000;

const fmtLocal = (ms: number) => {
    const d = new Date(ms);
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const localDateKey = (d: Date) => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

function groupSessionsByDay(sessions: Session[]): SessionsByDay[] {
    const buckets = new Map<string, { dateMs: number; millis: number }>();
    for (const session of sessions) {
        const start = new Date(session.start);
        const end = new Date(session.end ?? Date.now());
        const current = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
        while (current <= endDay) {
            const dayStart = current.getTime();
            const dayEnd = dayStart + MS_PER_DAY - 1;
            const sessionStart = Math.max(session.start, dayStart);
            const sessionEnd = Math.min(session.end ?? Date.now(), dayEnd);
            const key = localDateKey(current);
            const prev = buckets.get(key)?.millis ?? 0;
            buckets.set(key, {
                dateMs: dayStart,
                // Cap at 24 hours to prevent overlapping sessions or bad data from inflating totals
                millis: Math.min(MS_PER_DAY, prev + Math.max(0, sessionEnd - sessionStart)),
            });
            current.setDate(current.getDate() + 1);
        }
    }
    return Array.from(buckets.entries())
        .map(([_, v]) => ({ date: v.dateMs, millis: v.millis }))
        .sort((a, b) => a.date - b.date);
}

function enrichSession(session: Session): EnrichedSession {
    return {
        ...session,
        startFormatted: fmtLocal(session.start),
        endFormatted: session.end ? fmtLocal(session.end) : null,
    };
}

export const gatherLogData = async (projectId: string): Promise<LogData> => {
    const sessions = [];
    let time = 0;
    let ongoingTime = 0;

    const project = (await storage.getProjectById(projectId)).unwrap();
    const advance = project.advance || 0;

    for await (const session of storage.getSessions(projectId)) {
        sessions.push(session);
        if (!session.value.end) ongoingTime += Date.now() - session.value.start;
        else time += session.value.end - session.value.start;
    }

    const currency = await storage.getConfigValue("currency");
    const currentSession = sessions.find((s) => !s.value.end);

    // Gather notes/memos for this project
    const memos: Memo[] = await storage.getProjectNotes(projectId);

    // Expense-related calculations
    const totalExpenses = memos.filter((n) => n.type === "expense").reduce((sum, n) => sum + (n.cost || 0), 0);

    // Precompute values for templates and view functions
    const elapsed = ongoingTime + time;
    const decimalHours = elapsed / 3600000;
    const gross = decimalHours * project.rate;
    const advanceRemaining = (advance * 3600000) - elapsed;
    const finalAmount = (decimalHours - advance) * project.rate;
    const hoursExpr = `${decimalHours.toFixed(2)} h - ${advance} h`;
    const finalWithExpenses = finalAmount + totalExpenses;

    const sortedSessions = sessions.map((s) => s.value).sort((a, b) => a.start - b.start);
    const sessionsByDay = groupSessionsByDay(sortedSessions);
    const enrichedSessions = sortedSessions.map(enrichSession);
    const enrichedCurrent = currentSession ? enrichSession(currentSession.value) : undefined;

    const now = new Date();
    const due = new Date(now);
    due.setDate(due.getDate() + 30);
    const pad = (n: number) => n.toString().padStart(2, "0");
    const fmtDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    return {
        project: {
            id: projectId,
            name: project.name,
            rate: project.rate,
            advance,
        },
        sessions: enrichedSessions,
        time,
        ongoingTime,
        currency,
        currentSession: enrichedCurrent,
        elapsed,
        decimalHours: Number(decimalHours.toFixed(2)),
        gross: Number(gross.toFixed(2)),
        advanceRemaining,
        finalAmount: Number(finalAmount.toFixed(2)),
        hoursExpr,
        memos,
        totalExpenses: Number(totalExpenses.toFixed(2)),
        finalWithExpenses: Number(finalWithExpenses.toFixed(2)),
        sessionsByDay,
        invoiceDate: fmtDate(now),
        dueDate: fmtDate(due),
    };
};

export type { LogData };
