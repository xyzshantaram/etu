import { Command } from "commander";
import { match } from "@/oxide";
import { fail, getProjectId, respond } from "@/utils.ts";
import * as storage from "@/storage.ts";
import { Confirm } from "@cliffy/prompt";

interface EDeleteOpts {
    project: string;
    yes?: boolean;
}

const action = async ({ project, yes }: EDeleteOpts, cmd: Command) => {
    const isStructured = (cmd.optsWithGlobals() as Record<string, unknown>).structured;

    return await match(await getProjectId(project), {
        Err: (msg: string) => fail(cmd, msg),
        Ok: async (id: string) => {
            const project = (await storage.getProjectById(id)).unwrapOrElse(() =>
                fail(cmd, `Project ${id} does not exist.`)
            );
            if (isStructured && !yes) {
                fail(cmd, "--yes is required in structured mode for deletion.");
            }
            const confirmed = yes ||
                await Confirm.prompt(
                    {
                        message:
                            `THIS CANNOT BE UNDONE! Are you sure you want to delete the project ${project.name} with ID ${project.slug}?`,
                    },
                );

            if (confirmed) {
                await storage.deleteProject(id, true);
                respond(cmd, (data) => {
                    console.log(data.message);
                }, {
                    message: "Project deleted.",
                    deletedProject: project.slug,
                });
            }
        },
    });
};

export const del = new Command("delete").option(
    "-p --project <string>",
    "id of the project to delete. Uses the default if not specified.",
)
    .description("Deletes a project, all its sessions, and removes it from the default if set.")
    .option("--yes", "Skip confirmation prompt.")
    .action(action);
