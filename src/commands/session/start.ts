import { Command } from "commander";
import { fail, getProjectId, Maybe, respond, sessionName } from "@/utils.ts";
import * as storage from "@/storage.ts";
import { match } from "@/oxide";

interface EStartOpts {
    project: string;
}

const action = async (name: Maybe<string>, { project }: EStartOpts, cmd: Command) => {
    name = sessionName(name, false);
    return match(await getProjectId(project), {
        Err: (msg: string) => fail(cmd, msg),
        Ok: async (id: string) => {
            const currentTime = Date.now();
            const last = await storage.getLastSession(id);
            if (last && !last.value.end) {
                fail(cmd, "A session is already running for the specified project.");
            }
            const sessionId = await storage.putSession(id, { name, start: currentTime });
            const project = await storage.getProjectById(id);

            respond(cmd, (data) => {
                console.log(data.message);
            }, {
                message: `Started session ${name} in project ${project.unwrap().name}. Current time: ${
                    new Date(currentTime).toLocaleString()
                }`,
                session: {
                    ulid: sessionId,
                    name,
                    start: currentTime,
                    startFormatted: new Date(currentTime).toLocaleString(),
                },
            });
        },
    });
};

export const start = new Command("start")
    .option(
        "-p --project <string>",
        "id of the project to start the session in. Uses the default if not specified.",
    )
    .argument("[session-name]", "Optional name for the session.")
    .description("Start the clock.")
    .action(action);
