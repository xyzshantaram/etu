import { Command } from "commander";
import { fail, getProjectId, respond } from "@/utils.ts";
import * as storage from "@/storage.ts";
import { match } from "@/oxide";

interface EStartOpts {
    project: string;
}

const action = async ({ project }: EStartOpts, cmd: Command) => {
    return match(await getProjectId(project), {
        Err: (msg: string) => fail(cmd, msg),
        Ok: async (id: string) => {
            const last = await storage.getLastSession(id);
            const currentTime = Date.now();
            if (!last) {
                fail(cmd, "No sessions found for the specified project!");
            }
            if (last && !last.value.end) {
                fail(cmd, "A session is already running for the specified project.");
            }
            const name = last!.value.name;
            await storage.putSession(id, { name, start: currentTime });
            await storage.touchProject(id);
            const project = await storage.getProjectById(id);

            respond(cmd, (data) => {
                console.log(data.message);
            }, {
                message: `Started session ${name} in project ${project.unwrap().name}. Current time: ${
                    new Date(currentTime).toLocaleString()
                }`,
                session: {
                    name,
                    start: currentTime,
                    startFormatted: new Date(currentTime).toLocaleString(),
                },
            });
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
