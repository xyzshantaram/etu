import { Command } from "commander";
import { Select, SelectOption } from "@cliffy/prompt";
import { match } from "@/oxide";
import { getProjectId, Memo, scream } from "../../utils.ts";
import { Confirm } from "@cliffy/prompt";
import * as storage from "../../storage.ts";

interface EEditSessionOpts {
    project: string;
}

const action = async ({ project }: EEditSessionOpts) => {
    return await match(await getProjectId(project), {
        Err: (msg: string) => scream(msg),
        Ok: async (proj: string) => {
            const notes = await storage.getProjectNotes(proj);
            const options: SelectOption<Memo>[] = notes.map((itm) => ({
                value: itm,
                name: itm.name,
            }));

            const toDelete = await Select.prompt({
                message: "Which memo do you want to delete?",
                options,
            });

            if (await Confirm.prompt({ message: "Are you sure you want to delete this note?" })) {
                await storage.deleteNote(proj, toDelete.id);
            }
        },
    });
};

export const deleteMemo = new Command("delete")
    .option("-p --project", "id of the project whose note to delete. uses default project if not specified.")
    .description("Delete a memo (note or expense) from a project.")
    .action(action);
