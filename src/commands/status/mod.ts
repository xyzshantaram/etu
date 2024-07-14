import { Command } from "@/commander";
import { match } from "@/oxide";
import { getProjectId, heading, humanReadable, scream, success } from "../../utils.ts";
import * as storage from "../../storage.ts";

interface EStatusOpts {
    short: boolean;
    project: string;
}

const action = async ({ short, project }: EStatusOpts) => {
    return match(await getProjectId(project), {
        Err: (msg: string) => scream(msg),
        Ok: async (id: string) => {
            const project = (await storage.getProjectById(id)).unwrap();
            const session = await storage.getLastSession(id);

            if (short) {
                if (session && !session.value.end) {
                    console.log(`${project.slug}:${humanReadable(Date.now() - session.value.start, true)}`);
                }
                return;
            }

            if (!session) {
                return scream("No sessions exist for the specified project.");
            }

            if (session.value.end) {
                return scream(`No ongoing session found for the project ${heading(project.name)}.`);
            }

            console.log(
                `Time spent in ongoing session for project ${heading(project.name)}: ${success(humanReadable(Date.now() - session.value.start))
                }`,
            );
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
    .description("Print the status of the ongoing session, if any.")
    .action(action);
