import { Command } from "commander";
import { match } from "@/oxide";
import { fail, getProjectId, heading, humanReadable, respond, success } from "@/utils.ts";
import * as storage from "@/storage.ts";

interface EStatusOpts {
    short: boolean;
    project: string;
    showProject: boolean;
}

const action = async ({ short, project, showProject = false }: EStatusOpts, cmd: Command) => {
    return match(await getProjectId(project), {
        Err: (msg: string) => fail(cmd, msg),
        Ok: async (id: string) => {
            const project = await storage.getProjectById(id).then((f) => f.unwrap());
            const session = await storage.getLastSession(id);

            if (short) {
                if ((cmd.optsWithGlobals() as Record<string, unknown>).structured) {
                    const result = {
                        active: session !== undefined && !session.value.end,
                        project: { slug: project.slug, name: project.name },
                        session: session
                            ? {
                                name: session.value.name,
                                start: session.value.start,
                                startFormatted: new Date(session.value.start).toLocaleString(),
                                elapsed: session.value.end
                                    ? session.value.end - session.value.start
                                    : Date.now() - session.value.start,
                                elapsedFormatted: humanReadable(
                                    session.value.end
                                        ? session.value.end - session.value.start
                                        : Date.now() - session.value.start,
                                ),
                            }
                            : null,
                    };
                    respond(cmd, () => {}, result);
                } else if (session && !session.value.end) {
                    console.log(
                        `${showProject ? project.slug + ":" : ""}${
                            humanReadable(Date.now() - session.value.start, true)
                        }`,
                    );
                }
                return;
            }

            if (!session) {
                return fail(cmd, "No sessions exist for the specified project.");
            }

            if (session.value.end) {
                return fail(cmd, `No ongoing session found for the project ${heading(project.name)}.`);
            }

            const elapsed = Date.now() - session.value.start;
            const result = {
                active: true,
                project: {
                    slug: project.slug,
                    name: project.name,
                },
                session: {
                    name: session.value.name,
                    start: session.value.start,
                    startFormatted: new Date(session.value.start).toLocaleString(),
                    elapsed,
                    elapsedFormatted: humanReadable(elapsed),
                },
            };

            respond(cmd, (data) => {
                console.log(
                    `Time spent in ongoing session for project ${heading(data.project.name)}: ${
                        success(data.session.elapsedFormatted)
                    }`,
                );
            }, result);
        },
    });
};

export const status = new Command("status")
    .option(
        "-p --project <string>",
        "id of the project to summarize. Uses the default if not specified.",
    )
    .option(
        "-s --short",
        "Print only the time in a short format ([xx]h[yy]m[zz]s). If no session is ongoing, exit silently.",
    )
    .option(
        "--show-project",
        "For use with --short. Prints the project slug along with the time spent.",
    )
    .description("Print the status of the ongoing session, if any.")
    .action(action);
