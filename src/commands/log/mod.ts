import { Command } from "@/commander";
import * as storage from "../../storage.ts";
import { match } from "@/oxide";
import { getProjectId, heading, humanReadable, muted, scream, Session, sessionName, timeMs } from "../../utils.ts";
import { success } from "../../utils.ts";

interface ESummaryOpts {
    short: boolean;
    project: string;
    timeOnly: boolean;
}

const action = async ({ short, project, timeOnly }: ESummaryOpts) => {
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

            if (!short) {
                printLog(sessions.map((entry) => entry.value));
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
    .description(
        "Print the summary (hours worked, total billing) of the project.",
    )
    .action(action);

const destructureDate = (d: Date) => {
    return [d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()] as const;
};

function pad(strings: TemplateStringsArray, ...args: (string | number | boolean)[]) {
    const res: string[] = [];
    for (let i = 0; i < strings.length; i++) {
        res.push(strings[i]);
        if (typeof args[i] !== "undefined") {
            if (typeof args[i] === "number") {
                res.push(args[i].toString().padStart(2, "0"));
            } else res.push(args[i].toString());
        }
    }
    return muted(res.join(""));
}

function toEnglishIndex(n: number) {
    const last = n.toString().at(-1);
    if (last === "1") {
        return `${n}st`;
    }
    if (last === "2") {
        return `${n}nd`;
    }
    if (last === "3") {
        return `${n}rd`;
    }

    return `${n}th`;
}

function fmtSession(idx: string, sess: Session, indentWidth: number) {
    const start = new Date(sess.start);
    const indent = " ".repeat(indentWidth);

    const strings = [`  ${idx}. ${heading(sessionName(sess.name, false))}`];
    const duration = humanReadable((sess.end || Date.now()) - sess.start, true);
    strings.push(` (${success(duration)})`);

    if (!sess.end) {
        strings.push(`\n from ${start.toLocaleString()}`);
    } else {
        const end = new Date(sess.end);
        const [y1, a1, d1, h1, m1] = destructureDate(start);
        const [y2, a2, d2, h2, m2] = destructureDate(end);

        if (y1 === y2 && a1 === a2 && d1 === d2) {
            strings.push(pad`\n${indent}on ${y1}-${a1}-${d1} from ${h1}:${m1} to ${h2}:${m2}`);
        } else if (y1 === y2 && a1 === a2 && d1 !== d2) {
            strings.push(
                pad`\n${indent}in ${y1}-${a1} from ${h1}:${m1} (${toEnglishIndex(d1)}) to ${h2}:${m2} (${
                    toEnglishIndex(d2)
                })`,
            );
        } else if (y1 === y2 && a1 !== a2 && d1 !== d2) {
            strings.push(pad`\n${indent}in ${y1} from ${a1}-${d1} ${h1}:${m1} to ${a2}-${d2} ${h2}:${m2}`);
        } else {
            strings.push(pad`\n${indent}from ${y1}-${a1}-${d1} ${h1}:${m1} to ${y2}-${a2}-${d2} ${h2}:${m2}`);
        }
    }

    return strings.join("");
}

function printLog(sessions: Session[]) {
    console.log(heading("Sessions"));

    const length = sessions.length.toString().length;
    let count = 0;
    const idx = () => (++count).toString().padStart(length, "0");
    for (const session of sessions) {
        if (!session.end) continue;
        console.log(fmtSession(idx(), session, length + 4));
    }
    console.log("");
}
