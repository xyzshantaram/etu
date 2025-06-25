import * as storage from "../../../storage.ts";
import { Memo, Session } from "../../../utils.ts";

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
    notes: Memo[];
    totalExpenses: number;
    finalWithExpenses: number;
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
    const notes: Memo[] = await storage.getProjectNotes(projectId);

    // Expense-related calculations
    const totalExpenses = notes.filter((n) => n.type === "expense").reduce((sum, n) => sum + (n.cost || 0), 0);

    // Precompute values for templates and view functions
    const elapsed = ongoingTime + time;
    const decimalHours = elapsed / 3600000;
    const gross = decimalHours * project.rate;
    const advanceRemaining = (advance * 3600000) - elapsed;
    const finalAmount = (decimalHours - advance) * project.rate;
    const hoursExpr = `(${decimalHours.toFixed(2)} h - ${advance} h)`;
    const finalWithExpenses = finalAmount + totalExpenses;

    return {
        project: {
            id: projectId,
            name: project.name,
            rate: project.rate,
            advance,
        },
        sessions: sessions.map((s) => s.value).sort((a, b) => a.start - b.start),
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
        notes,
        totalExpenses: Number(totalExpenses.toFixed(2)),
        finalWithExpenses: Number(finalWithExpenses.toFixed(2)),
    };
};

export type { LogData };
