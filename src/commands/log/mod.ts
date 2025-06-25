import { Command } from "commander";
import { Table } from "@cliffy/table";
import * as storage from "../../storage.ts";
import { match } from "@/oxide";
import { dataPath, getProjectId, heading, humanReadable, scream, Session, sessionName, timeMs } from "../../utils.ts";
import { success } from "../../utils.ts";
import { Liquid } from "liquidjs";
import * as path from "@std/path";

interface ESummaryOpts {
    short: boolean;
    project: string;
    timeOnly: boolean;
    days: boolean;
    template?: string;
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
    // Precomputed values for templates and view functions
    elapsed: number;
    decimalHours: number;
    gross: number;
    advanceRemaining: number;
    finalAmount: number;
    hoursExpr: string;
}

const gatherLogData = async (projectId: string): Promise<LogData> => {
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

    // Precompute values for templates and view functions
    const elapsed = ongoingTime + time;
    const decimalHours = elapsed / 3600000;
    const gross = decimalHours * project.rate;
    const advanceRemaining = (advance * 3600000) - elapsed;
    const finalAmount = (decimalHours - advance) * project.rate;
    const hoursExpr = `(${decimalHours.toFixed(2)} h - ${advance} h)`;

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
    };
};

const renderLogData = async (data: LogData, opts: ESummaryOpts) => {
    const { short, timeOnly, days, template } = opts;
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
        finalAmount,
        hoursExpr,
    } = data;

    // If --template is provided, try to render the template if it exists
    if (template) {
        const templatePath = path.join(dataPath, "templates", `${template}.liquid`);
        try {
            // Check if file exists
            await Deno.stat(templatePath);
            // Read template
            const tpl = await Deno.readTextFile(templatePath);
            const engine = new Liquid();
            engine.registerFilter("humanReadable", (ms: number) => humanReadable(ms, false));
            const context = { ...data, now: Date.now() };
            const html = await engine.parseAndRender(tpl, context);
            console.log(html);
            return;
        } catch (e) {
            if (e instanceof Deno.errors.NotFound) {
                scream(`Template '${template}' not found at ${templatePath}`);
            } else {
                scream(`Error rendering template: ${e}`);
            }
            return;
        }
    }

    const money = (amt: string | number) => `${currency}${amt}`;

    if (timeOnly) {
        return console.log(humanReadable(elapsed, short));
    }

    console.log(`Project ${heading(project.name)}\n`);

    if (sessions.length === 0) {
        scream("No sessions exist for the specified project");
    }

    if (days) {
        printTimesheet(sessions);
    } else if (!short) {
        printLog(sessions);
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
    const amt = heading(money(finalAmount));
    console.log(`Final amount: ${hoursExpr} * ${money(project.rate)}/h = ${amt}`);
};

const action = async (opts: ESummaryOpts) => {
    return match(await getProjectId(opts.project), {
        Err: (msg: string) => scream(msg),
        Ok: async (id: string) => {
            const data = await gatherLogData(id);
            await renderLogData(data, opts);
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
    .option("--template <name>", "Render using a named HTML template if it exists in your data/templates directory.")
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
