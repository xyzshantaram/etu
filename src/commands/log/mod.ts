import { Command } from "@/commander";
import * as storage from "../../storage.ts";
import { match } from "@/oxide";
import { getProjectId, heading, humanReadable, scream, Session, sessionName, timeMs } from "../../utils.ts";

interface ESummaryOpts {
    short: boolean;
    id: string;
}

const action = async ({ short, id }: ESummaryOpts) => {
    return match(await getProjectId(id), {
        Err: (msg: string) => scream(msg),
        Ok: async (id: string) => {
            const sessions = [];
            let time = 0;
            let ongoingTime = 0;

            const project = (await storage.getProjectById(id)).unwrap();

            for await (const session of storage.getSessions(id)) {
                sessions.push(session);
                if (!session.end) ongoingTime += Date.now() - session.start;
                else time += session.end - session.start;
            }

            console.log(`Viewing project ${heading(project.name)}`);

            if (sessions.length === 0) {
                scream("No sessions exist for the specified project");
            }

            if (ongoingTime) {
                console.log(
                    `Current session: ${sessionName(sessions.at(-1)?.name)}`,
                );
                console.log(
                    `Time spent in current session: ${humanReadable(ongoingTime)}\n`,
                );
            }

            console.log(`Total time spent: ${heading(humanReadable(ongoingTime + time))}\n`);
            const timeHours = (ongoingTime + time) / timeMs({ h: 1 });
            const currency = await storage.getConfigValue("currency");
            const amt = heading(`${currency}${(timeHours * project.rate).toFixed(2)}`);
            console.log(`${timeHours.toFixed(2)} hours * ${currency}${project.rate}/hr = ${amt}`);

            if (!short) {
                printLog(sessions);
            }
        },
    });
};

export const log = new Command("log")
    .option(
        "-i --id <string>",
        "id of the project to summarize. Uses the default if not specified.",
    )
    .option("-s --short", "Don't print the log of hours worked.")
    .description(
        "Print the summary (hours worked, total billing) of the project.",
    )
    .action(action);

function printLog(sessions: Session[]) {
    console.log(heading("\nSession log:"));
    for (const session of sessions) {
        if (!session.end) continue;
        console.log(`**** ${heading(sessionName(session.name))} ****`);
        console.log(`  start: ${new Date(session.start).toLocaleString()}`);
        console.log(`  end: ${new Date(session.end).toLocaleString()}`);
    }
}
