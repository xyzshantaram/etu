import { Command } from "commander";
import { Table } from "@cliffy/table";
import * as storage from "../../storage.ts";
import { match } from "@/oxide";
import { getProjectId, heading, humanReadable, scream, Session, sessionName, timeMs } from "../../utils.ts";
import { success } from "../../utils.ts";

interface ESummaryOpts {
    short: boolean;
    project: string;
    timeOnly: boolean;
    days: boolean;
}

const action = async ({ short, project, timeOnly, days }: ESummaryOpts) => {
    return match(await getProjectId(project), {
        Err: (msg: string) => scream(msg),
        Ok: async (id: string) => {
            const sessions = [];
            let time = 0;
            let ongoingTime = 0;

            const project = (await storage.getProjectById(id)).unwrap();
            const advance = project.advance || 0;

            for await (const session of storage.getSessions(id)) {
                sessions.push(session);
                if (!session.value.end) ongoingTime += Date.now() - session.value.start;
                else time += session.value.end - session.value.start;
            }

            if (timeOnly) {
                return console.log(humanReadable(ongoingTime + time, short));
            }

            console.log(`Project ${heading(project.name)}\n`);

            if (sessions.length === 0) {
                scream("No sessions exist for the specified project");
            }

            const list = sessions.map((entry) => entry.value).sort((a, b) => a.start - b.start);
            if (days) {
                printTimesheet(list);
            } else if (!short) {
                printLog(list);
            }

            const curr = await storage.getConfigValue("currency");
            const money = (amt: string | number) => `${curr}${amt}`;

            const elapsed = ongoingTime + time;
            const timeHours = elapsed / timeMs({ h: 1 });
            const totalTime = heading(humanReadable(elapsed));
            const decHours = timeHours.toFixed(2);
            const gross = timeHours * project.rate;
            const hoursExpr = `(${decHours} h - ${advance} h)`;

            if (ongoingTime) {
                const session = sessions.at(-1);
                console.log(`Current session: ${sessionName(session?.value.name, false)}`);
                console.log(`Started at: ${new Date(session?.value.start!).toLocaleString()}`);
                console.log(`Time spent in current session: ${humanReadable(ongoingTime)}\n`);
            }

            console.log(`Total time spent: ${totalTime} = ${decHours} h\n`);
            console.log(`Gross amount (${decHours} h * ${money(project.rate)}/h): ${money(gross.toFixed(2))}`);
            console.log(`Hours paid in advance: ${advance} h`);
            const advanceRemaining = timeMs({ h: advance }) - elapsed;
            if (advanceRemaining > 0) console.log("Advance remaining:", humanReadable(advanceRemaining));
            const amt = heading(money(((timeHours - advance) * project.rate).toFixed(2)));
            console.log(`Final amount: ${hoursExpr} * ${money(project.rate)}/h = ${amt}`);
        },
    });
};

export const log = new Command("log")
    .option(
        "-p --project <string>",
        "id of the project to summarize. Uses the default if not specified.",
    )
    .option("--time-only", "Print only the total hours worked.")
    .option(
        "-s --short",
        "Don't print the log of hours worked. If used in conjunction with --time-only, prints the time in a short format ([xx]h[yy]m[zz]s).",
    )
    .option("-d --days", "Group hours by day instead of session")
    .description(
        "Print the summary (hours worked, total billing) of the project.",
    )
    .action(action);

const destructureDate = (d: Date) => {
    // month is 0-indexed, fix this
    return [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()] as const;
};

function printTimesheet(sessions: Session[]) {
    // bucket sessions into days

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
            // session does not spill into another day
            const key = new Date(startYear, startMonth - 1, startDate).getTime();
            const hours = end.getTime() - start.getTime();
            updateBucket(key, hours);
        } else {
            // session spans multiple days
            for (const pointer = new Date(start); pointer <= end; pointer.setDate(pointer.getDate() + 1)) {
                const key = new Date(pointer.getFullYear(), pointer.getMonth(), pointer.getDate()).getTime();
                if (pointer.getDay() == start.getDay()) {
                    // at the beginning
                    pointer.setHours(23, 59, 59, 999);
                    updateBucket(key, pointer.getTime() - start.getTime());
                    pointer.setHours(0, 0, 0, 0);
                } else if (pointer.getDay() == end.getDay()) {
                    // at the end
                    pointer.setHours(0, 0, 0, 0);
                    updateBucket(key, end.getTime() - pointer.getTime());
                } else {
                    // in the middle, hopefully nobody is working 24 hours a day lol
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

const toDateStr = (time: number) => {
    const date = new Date(time);
    const [y, a, d, h, m] = destructureDate(date).map((itm) => itm.toString().padStart(2, "0"));
    return `${y}-${a}-${d} ${h}:${m}`;
};

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
