import { Command } from "@/commander";
import { getProjectId, Maybe, scream, sessionName } from "../../utils.ts";
import * as storage from "../../storage.ts";
import { match } from "@/oxide";

interface EStartOpts {
    project: string;
}

const action = async (name: Maybe<string>, { project }: EStartOpts) => {
    name = sessionName(name, false);
    return match(await getProjectId(project), {
        Err: (msg: string) => scream(msg),
        Ok: async (id: string) => {
            const currentTime = Date.now();
            const last = await storage.getLastSession(id);
            if (last && !last.value.end) {
                scream("A session is already running for the specified project.");
            }
            await storage.putSession(id, { name, start: currentTime });
            const project = await storage.getProjectById(id);

            console.log(
                `Started session ${name} in project ${project.unwrap().name}. Current time: ${new Date(currentTime).toLocaleString()
                }`,
            );
        },
    });
};

export const start = new Command("start")
    .option(
        "-p --project <string>",
        "id of the project to start. Uses the default if not specified.",
    )
    .argument("[session-name]", "Optional name for the session.")
    .description("Start the clock.")
    .action(action);
