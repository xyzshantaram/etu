import { Table } from "@cliffy/table";
import { heading, humanReadable, scream, Session, sessionName, success, timeMs } from "../../../utils.ts";
import type { LogData } from "./gather.ts";

const destructureDate = (d: Date) => {
    return [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()] as const;
};

const toDateStr = (time: number) => {
    const date = new Date(time);
    const [y, a, d, h, m] = destructureDate(date).map((itm) => itm.toString().padStart(2, "0"));
    return `${y}-${a}-${d} ${h}:${m}`;
};

function printTimesheet(sessions: Session[]) {
    const buckets: Map<number, number> = new Map();
    const table: string[][] = [];
    sessions.forEach((session) => {
        const start = new Date(session.start);
        const end = new Date(session.end ? session.end : Date.now());
        const [startYear, startMonth, startDate] = destructureDate(start);
        const [_, __, endDate] = destructureDate(end);

        const updateBucket = (key: number, val: number) => {
            const prev = buckets.get(key) || 0;
            buckets.set(key, Math.min(prev + val, timeMs({ h: 24 })));
        };

        if (startDate === endDate) {
            const key = new Date(startYear, startMonth - 1, startDate).getTime();
            const hours = end.getTime() - start.getTime();
            updateBucket(key, hours);
        } else {
            for (const pointer = new Date(start); pointer <= end; pointer.setDate(pointer.getDate() + 1)) {
                const key = new Date(pointer.getFullYear(), pointer.getMonth(), pointer.getDate()).getTime();
                if (pointer.getDay() == start.getDay()) {
                    pointer.setHours(23, 59, 59, 999);
                    updateBucket(key, pointer.getTime() - start.getTime());
                    pointer.setHours(0, 0, 0, 0);
                } else if (pointer.getDay() == end.getDay()) {
                    pointer.setHours(0, 0, 0, 0);
                    updateBucket(key, end.getTime() - pointer.getTime());
                } else {
                    updateBucket(key, 24 * 60 * 60 * 1000);
                }
            }
        }
    });

    table.push(["Month", "Date", "Hours"]);
    let currentMonth = -1;
    buckets.forEach((millis, key) => {
        const date = new Date(key);
        let month = "";
        if (currentMonth != date.getMonth() - 1) {
            currentMonth = date.getMonth() - 1;
            month = new Intl.DateTimeFormat("en-GB", { month: "long" }).format(date);
        }
        table.push([
            month,
            heading(new Intl.DateTimeFormat("en-GB").format(date)),
            success(humanReadable(millis, true)),
        ]);
    });
    Table.from(table).border(true).render();
}

function printLog(sessions: Session[]) {
    console.log(heading("Sessions"));
    const rows = [["Index", "Name", "From", "Duration"]];
    const length = sessions.length.toString().length;
    let count = 0;
    const idx = () => (++count).toString().padStart(length, "0");
    for (const session of sessions) {
        if (!session.end) continue;
        const duration = humanReadable((session.end || Date.now()) - session.start, true);
        rows.push([
            idx(),
            heading(sessionName(session.name, false)),
            toDateStr(session.start),
            success(duration),
        ]);
    }
    Table.from(rows).border(true).render();
    console.log("");
}

interface TerminalRenderOpts {
    short: boolean;
    timeOnly: boolean;
    days: boolean;
}

export function renderLogTerminal(data: LogData, opts: TerminalRenderOpts) {
    const {
        project,
        sessions,
        ongoingTime,
        currency,
        currentSession,
        elapsed,
        decimalHours,
        gross,
        advanceRemaining,
        hoursExpr,
        notes,
        totalExpenses,
        finalWithExpenses,
    } = data;
    const { short, timeOnly, days } = opts;
    const money = (amt: string | number) => `${currency}${amt}`;

    const expenses = notes ? notes.filter((n) => n.type === "expense") : [];
    const kvMemos = notes ? notes.filter((n) => n.type === "kv") : [];

    if (timeOnly) {
        return console.log(humanReadable(elapsed, short));
    }
    console.log(`Project ${heading(project.name)}\n`);
    if (sessions.length === 0) scream("No sessions exist for the specified project");
    if (days) {
        printTimesheet(sessions);
    } else if (!short) {
        printLog(sessions);
    }

    // Expenses: show below sessions table, above summary
    if (expenses.length) {
        console.log("Expenses:");
        expenses.forEach((item) => {
            console.log(
                `* ${item.name}: ${currency}${item.cost}` +
                    (item.description ? ` (${item.description})` : ""),
            );
        });
        console.log("");
    }

    const totalTime = heading(humanReadable(elapsed));
    const decHours = decimalHours.toFixed(2);
    if (ongoingTime && currentSession) {
        console.log(`Current session: ${sessionName(currentSession.name, false)}`);
        console.log(`Started at: ${new Date(currentSession.start).toLocaleString()}`);
        console.log(`Time spent in current session: ${humanReadable(ongoingTime)}\n`);
    }
    console.log(`Total time spent: ${totalTime} = ${decHours} h\n`);
    console.log(`Gross amount (${decHours} h * ${money(project.rate)}/h): ${money(gross)}`);
    console.log(`Hours paid in advance: ${project.advance} h`);
    if (advanceRemaining > 0) console.log("Advance remaining:", humanReadable(advanceRemaining));
    const finalLine = `Final amount: ${hoursExpr} * ${money(project.rate)}/h` +
        (totalExpenses ? ` + ${money(totalExpenses)} (Expenses)` : "") +
        ` = ${heading(money(finalWithExpenses))}`;
    console.log(finalLine);

    // Note memos: show after summary
    if (kvMemos.length) {
        console.log("\nMemos");
        kvMemos.forEach((item) => {
            console.log(`* ${item.name} = ${item.description ?? ""}`);
        });
    }
}
