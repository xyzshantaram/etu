import { Command } from "commander";
import { match } from "@/oxide";
import * as storage from "@/storage.ts";
import { fail, getProjectId, humanReadable, respond, sessionName } from "@/utils.ts";

interface EStopOpts {
    project: string;
}

const action = async ({ project }: EStopOpts, cmd: Command) => {
    return await match(await getProjectId(project), {
        Err: (msg: string) => fail(cmd, msg),
        Ok: async (id: string) => {
            const session = await storage.getLastSession(id);
            if (!session || !!session.value.end) {
                fail(cmd, "No ongoing session found for given project.");
            }
            const now = Date.now();
            await storage.endSession(session!, now);
            await storage.touchProject(id);
            const name = sessionName(session?.value.name);
            const duration = now - session!.value.start;
            const durationFormatted = humanReadable(duration);
            respond(cmd, (data) => {
                console.log(data.message);
            }, {
                message: `Stopped session ${name}. Time worked: ${durationFormatted}`,
                session: {
                    name: session!.value.name,
                    start: session!.value.start,
                    end: now,
                    duration,
                    durationFormatted,
                },
            });
        },
    });
};

export const stop = new Command("stop")
    .option(
        "-p --project <string>",
        "id of the project to stop the session for. Uses the default if not specified.",
    )
    .description("Stop the clock.")
    .action(action);
