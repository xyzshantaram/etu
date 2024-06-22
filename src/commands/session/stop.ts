import { Command } from "@/commander";
import { match } from "@/oxide";
import * as storage from "../../storage.ts";
import { getProjectId, scream } from "../../utils.ts";

interface EStopOpts {
    id: string;
}

const action = async ({ id }: EStopOpts) => {
    return await match(await getProjectId(id), {
        Err: (msg: string) => scream(msg),
        Ok: async (id: string) => {
            const session = await storage.getLastSession(id);
            if (!session || !!session.value.end) {
                scream("No ongoing session found for given project.");
            }
            await storage.endSession(session!, Date.now());
        },
    });
};

export const stop = new Command("stop")
    .option(
        "-i --id <string>",
        "id of the project to stop. Uses the default if not specified.",
    )
    .description("Stop the clock.")
    .action(action);
