import { Command } from "@/commander";
import { EtuStorage } from "../storage.ts";
import { match } from "@/oxide";
import { Session, getProjectId, humanReadable, msToTime, sessionName, timeMs } from "../utils.ts";

interface ESummaryOpts {
    log: boolean;
    id: string;
}

const action = async ({ log, id }: ESummaryOpts) => {
    return match(await getProjectId(id), {
        Err: (msg: string) => { throw new Error(msg) },
        Ok: async (id: string) => {
            const sessions = [];
            let time = 0;
            let ongoingTime = 0;

            const project = (await EtuStorage.getProjectById(id)).unwrap();

            for await (const session of EtuStorage.getSessions(id)) {
                sessions.push(session);
                if (!session.end) ongoingTime += Date.now() - session.start;
                else time += session.end - session.start;
            }

            console.log(`Time spent in project ${project.name}`);

            if (sessions.length === 0) {
                throw new Error("No sessions exist for the specified project");
            }

            if (ongoingTime) {
                console.log(`Current session: ${sessionName(sessions.at(-1)?.name)}`);
                console.log(`Time spent in current session: ${humanReadable(ongoingTime)}\n`);
            }

            console.log(`Total time spent: ${humanReadable(ongoingTime + time)}`);
            const timeHours = (ongoingTime + time) / timeMs({ h: 1 });
            const currency = await EtuStorage.getCurrency();
            console.log(`${timeHours.toFixed(2)} hours: ${currency}${(timeHours * project.rate).toFixed(2)}`);

            if (log) {
                printLog(sessions);
            }
        }
    });
}

export const summary = (cmd: Command) => {
    return cmd.command('summary')
        .option('-i --id <string>', 'id of the project to summarize. Uses the default if not specified.')
        .option('--no-log', "Don't print the log of hours worked.")
        .description('Print the summary (hours worked, total billing) of the project.')
        .action(action);
}

function printLog(sessions: Session[]) {
    console.log(JSON.stringify(sessions, null, 4));
}
