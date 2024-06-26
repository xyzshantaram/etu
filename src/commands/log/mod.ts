import { Command } from "@/commander";
import * as storage from "../../storage.ts";
import { match } from "@/oxide";
import { getProjectId, heading, humanReadable, scream, Session, sessionName, timeMs } from "../../utils.ts";

interface ESummaryOpts {
    short: boolean;
    project: string;
}

const action = async ({ short, project }: ESummaryOpts) => {
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

            console.log(`Project ${heading(project.name)}\n`);

            if (sessions.length === 0) {
                scream("No sessions exist for the specified project");
            }

            if (ongoingTime) {
                const session = sessions.at(-1);
                console.log(`Current session: ${sessionName(session?.value.name)}`);
                console.log(`Started at: ${new Date(session?.value.start!).toLocaleString()}`);
                console.log(`Time spent in current session: ${humanReadable(ongoingTime)}\n`);
            }

            if (!short) {
                printLog(sessions.map((entry) => entry.value));
            }

            const curr = await storage.getConfigValue("currency");
            const money = (amt: string | number) => `${curr}${amt}`;

            const elapsed = ongoingTime + time;
            const timeHours = (elapsed) / timeMs({ h: 1 });
            const totalTime = heading(humanReadable(elapsed));
            const decHours = timeHours.toFixed(2);
            const gross = timeHours * project.rate;
            const hoursExpr = `(${decHours} h - ${advance} h)`;

            console.log(`Total time spent: ${totalTime} = ${decHours} h\n`);
            console.log(`Gross amount (${decHours} h * ${money(project.rate)}/h): ${money(gross.toFixed(2))}`);
            console.log(`Hours paid in advance: ${advance} h`);
            const advanceRemaining = timeMs({ h: advance }) - (elapsed);
            if (advanceRemaining > 0) console.log('Advance remaining:', humanReadable(advanceRemaining));
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
    .option("-s --short", "Don't print the/ log of hours worked.")
    .description(
        "Print the summary (hours worked, total billing) of the project.",
    )
    .action(action);

function printLog(sessions: Session[]) {
    console.log(heading("Sessions"));

    const length = sessions.length.toString().length;
    let count = 0;
    const idx = () => (++count).toString().padStart(length, '0');
    for (const session of sessions) {
        if (!session.end) continue;
        console.log(`  ${idx()}. ${heading(sessionName(session.name, false))}`);
        console.log(`    start: ${new Date(session.start).toLocaleString()}`);
        console.log(`    end: ${new Date(session.end).toLocaleString()}`);
    }
    console.log('');
}
