import { Command } from "commander";
import { Confirm, Input, Select, SelectOption } from "@cliffy/prompt";
import { match } from "@/oxide";
import { BareMemo, getProjectId, Memo, scream } from "../../utils.ts";
import * as storage from "../../storage.ts";
import { promptForCost } from "./mod.ts";

interface EditMemoOpts {
    project?: string;
}

const action = async ({ project }: EditMemoOpts) => {
    return await match(await getProjectId(project), {
        Err: (msg: string) => scream(msg),
        Ok: async (proj: string) => {
            const notes = await storage.getProjectNotes(proj);
            if (!notes.length) return console.log("No memos to edit.");
            const noteOpts: SelectOption<Memo>[] = notes.map((itm) => ({
                value: itm,
                name: itm.name,
            }));

            const toEdit = await Select.prompt({
                message: "Which memo do you want to edit?",
                options: noteOpts,
            });

            const actionOpts = [{
                value: "desc",
                name: "Change description",
            }, {
                value: "name",
                name: "Change memo name",
            }];

            if (toEdit.type === "expense") {
                actionOpts.push({
                    value: "cost",
                    name: "Change expense cost",
                });
            }

            const update = await Select.prompt({
                message: "What do you want to do?",
                options: actionOpts,
            });

            let updated: BareMemo = { name: toEdit.name, type: toEdit.type } as BareMemo;

            switch (update) {
                case "desc": {
                    const desc = await Input.prompt({
                        message: `New description (leave blank to keep current).`,
                    });
                    updated = { ...updated, type: "kv", description: desc || toEdit.description };
                    break;
                }
                case "name": {
                    const name = await Input.prompt({ message: `New name (leave blank to keep '${toEdit.name}'):` });
                    updated.name = name || toEdit.name;
                    break;
                }
                case "cost": {
                    if (toEdit.type !== "expense") {
                        return scream("Error: invalid note type for cost edit. This is an etu bug");
                    }
                    const cost = await promptForCost(toEdit.cost);
                    updated = { ...updated, type: "expense", cost };
                    break;
                }
                default:
                    break;
            }

            if (await Confirm.prompt({ message: "Save changes?" })) {
                await storage.deleteNote(proj, toEdit.id);
                await storage.createNote(proj, updated);
                console.log("Memo updated.");
            } else {
                console.log("Edit cancelled.");
            }
        },
    });
};

export const edit = new Command("edit")
    .option("-p --project <project>", "id of the project whose memo to edit. uses default project if not specified.")
    .description("Edit a memo (note or expense) of a project.")
    .action(action);
