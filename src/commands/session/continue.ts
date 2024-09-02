import { Command } from "@/commander";
import { getProjectId, scream } from "../../utils.ts";
import * as storage from "../../storage.ts";
import { match } from "@/oxide";

interface EStartOpts {
    project: string;
}

const action = async ({ project }: EStartOpts) => {
    return match(await getProjectId(project), {
        Err: (msg: string) => scream(msg),
        Ok: async (id: string) => {
            const last = await storage.getLastSession(id);
            const currentTime = Date.now();
            if (!last) {
                scream("No sessions found for the specified project!");
            }
            if (last && !last.value.end) {
                scream("A session is already running for the specified project.");
            }
            const name = last!.value.name;
            await storage.putSession(id, { name, start: currentTime });
            const project = await storage.getProjectById(id);

            console.log(
                `Started session ${name} in project ${project.unwrap().name}. Current time: ${new Date(currentTime).toLocaleString()
                }`,
            );
        },
    });
};

export const cont = new Command("continue")
    .option(
        "-p --project <string>",
        "id of the project to continue in. Uses the default if not specified.",
    )
    .description("Start the clock.")
    .action(action);
