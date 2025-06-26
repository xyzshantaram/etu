import * as storage from "../../../storage.ts";
import { Memo, Session } from "../../../utils.ts";

export interface SessionsByDay {
    date: number; // ms since epoch, local midnight
    millis: number;
}

interface LogData {
    project: {
        id: string;
        name: string;
        rate: number;
        advance: number;
    };
    sessions: Session[];
    time: number;
    ongoingTime: number;
    currency: string;
    currentSession?: Session;
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
}

// Buckets sessions into per-day millis worked, ISO date keys.
function groupSessionsByDay(sessions: Session[]): SessionsByDay[] {
    const buckets: Map<string, number> = new Map();
    for (const session of sessions) {
        const start = new Date(session.start);
        const end = new Date(session.end ?? Date.now());
        const current = new Date(start);
        current.setHours(0, 0, 0, 0);
        const endDay = new Date(end);
        endDay.setHours(0, 0, 0, 0);
        while (current <= endDay) {
            const dayStart = +current;
            const dayEnd = new Date(current);
            dayEnd.setHours(23, 59, 59, 999);
            const sessionStart = Math.max(session.start, dayStart);
            const sessionEnd = Math.min(session.end ?? Date.now(), +dayEnd);
            const key = current.toISOString().slice(0, 10);
            const prev = buckets.get(key) ?? 0;
            buckets.set(key, prev + Math.max(0, sessionEnd - sessionStart));
            current.setDate(current.getDate() + 1);
        }
    }
    return Array.from(buckets.entries())
        .map(([date, millis]) => {
            // date is ISO string. Convert to ms (local timezone, midnight)
            const d = new Date(date);
            d.setHours(0, 0, 0, 0);
            return { date: d.getTime(), millis };
        })
        .sort((a, b) => a.date - b.date);
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

    return {
        project: {
            id: projectId,
            name: project.name,
            rate: project.rate,
            advance,
        },
        sessions: sortedSessions,
        time,
        ongoingTime,
        currency,
        currentSession: currentSession?.value,
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
    };
};

export type { LogData };
