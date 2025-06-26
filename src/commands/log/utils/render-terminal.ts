import { Table } from "@cliffy/table";
import { heading, humanReadable, scream, Session, sessionName, success } from "../../../utils.ts";
import type { LogData, SessionsByDay } from "./gather.ts";

function printTimesheet(sessionsByDay: SessionsByDay[]) {
    const table: string[][] = [["Date", "Hours"]];
    for (const { date, millis } of sessionsByDay) {
        table.push([
            heading(new Date(date).toLocaleDateString()),
            success(humanReadable(millis, true)),
        ]);
    }
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
            new Date(session.start).toLocaleString(),
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
        memos,
        totalExpenses,
        finalWithExpenses,
        sessionsByDay,
    } = data;
    const { short, timeOnly, days } = opts;
    const money = (amt: string | number) => `${currency}${amt}`;

    const expenses = memos ? memos.filter((n) => n.type === "expense") : [];
    const notes = memos ? memos.filter((n) => n.type === "kv") : [];

    if (timeOnly) {
        return console.log(humanReadable(elapsed, short));
    }
    console.log(`Project ${heading(project.name)}\n`);
    if (sessions.length === 0) scream("No sessions exist for the specified project");
    if (days) {
        printTimesheet(sessionsByDay);
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
    const finalLine = `Final amount: (${hoursExpr}) * ${money(project.rate)}/h` +
        (totalExpenses ? ` + ${money(totalExpenses)} (Expenses)` : "") +
        ` = ${heading(money(finalWithExpenses))}`;
    console.log(finalLine);

    // Note memos: show after summary
    if (notes.length) {
        console.log("\nMemos");
        notes.forEach((item) => {
            console.log(`* ${item.name} = ${item.description ?? ""}`);
        });
    }
}
