import { Command } from "commander";
import { Input } from "@cliffy/prompt";
import { match } from "@/oxide";
import { BareMemo, getProjectId, scream } from "../../utils.ts";
import { promptForCost } from "./mod.ts";
import * as storage from "../../storage.ts";

interface AddMemoOpts {
    name: string;
    expense?: boolean;
    project?: string;
}

const action = async ({ name, expense, project }: AddMemoOpts) => {
    return await match(await getProjectId(project), {
        Err: (msg: string) => scream(msg),
        Ok: async (proj: string) => {
            let note: BareMemo = { name, type: "kv" };

            note.description = await Input.prompt({
                message: "Memo description (optional, leave blank for none):",
            });

            if (expense) {
                const cost = await promptForCost();
                note = { ...note, type: "expense", cost };
            }

            await storage.createNote(proj, note);
            console.log(`Memo '${name}' added to project '${proj}'.`);
        },
    });
};

export const add = new Command("add")
    .argument("<name>", "The name of the memo. Memos can optionally have a description.")
    .option("-e --expense", "Whether the memo to add indicates an expense.")
    .option(
        "-p --project <project>",
        "id of the project to which to add the memo. uses default project if not specified.",
    )
    .description("Add a memo to a project.")
    .action(action);
