import { Command } from "@/commander";
import { getProjectId, Maybe, scream } from "../../utils.ts";
import * as storage from "../../storage.ts";
import { match } from "@/oxide";

interface EStartOpts {
    id: string;
}

const action = async (name: Maybe<string>, { id }: EStartOpts) => {
    return match(await getProjectId(id), {
        Err: (msg: string) => scream(msg),
        Ok: async (id: string) => {
            const currentTime = Date.now();
            await storage.putSession(id, { name, start: currentTime });
            const project = await storage.getProjectById(id);

            console.log(
                `Started session ${name} in project ${project.unwrap().name}. Current time: ${
                    new Date(currentTime).toLocaleString()
                }`,
            );
        },
    });
};

export const start = new Command("start")
    .option(
        "-i --id <string>",
        "id of the project to start. Uses the default if not specified.",
    )
    .argument("[session-name]", "Optional name for the session.")
    .description("Start the clock.")
    .action(action);
