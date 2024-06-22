import { Command } from "@/commander";
import { match } from "@/oxide";
import { getProjectId, scream } from "../../utils.ts";
import * as storage from "../../storage.ts";
import { Confirm } from "@/cliffy/prompt";

interface EDeleteOpts {
    id: string;
}

const action = async ({ id }: EDeleteOpts) => {
    return await match(await getProjectId(id), {
        Err: (msg: string) => scream(msg),
        Ok: async (id: string) => {
            const project = (await storage.getProjectById(id)).unwrapOrElse(() =>
                scream(`Project ${id} does not exist.`)
            );
            if (
                await Confirm.prompt(
                    { message: `THIS CANNOT BE UNDONE! Are you sure you want to delete the project ${project.name} with ID ${project.slug}?` }
                )
            ) {
                await storage.deleteProject(id);
            }
        },
    });
};

export const del = new Command("delete").option(
    "-p --project <string>",
    "id of the project to delete. Uses the default if not specified.",
)
    .description("Deletes a project, all its sessions, and removes it from the default if set.")
    .action(action);
