import { Command } from "@/commander";
import { match } from "@/oxide";
import * as storage from "../../storage.ts";
import { getProjectId, humanReadable, scream, sessionName } from "../../utils.ts";

interface EStopOpts {
    project: string;
}

const action = async ({ project }: EStopOpts) => {
    return await match(await getProjectId(project), {
        Err: (msg: string) => scream(msg),
        Ok: async (id: string) => {
            const session = await storage.getLastSession(id);
            if (!session || !!session.value.end) {
                scream("No ongoing session found for given project.");
            }
            const now = Date.now();
            await storage.endSession(session!, now);
            const name = sessionName(session?.value.name);
            const time = humanReadable(now - session!.value.start);
            console.log(`Stopped session ${name}. Time worked: ${time}`);
        },
    });
};

export const stop = new Command("stop")
    .option(
        "-p --project <string>",
        "id of the project to stop. Uses the default if not specified.",
    )
    .description("Stop the clock.")
    .action(action);
