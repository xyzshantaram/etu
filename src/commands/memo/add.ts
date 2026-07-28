import { Command } from "commander";
import { Input } from "@cliffy/prompt";
import { match } from "@/oxide";
import { BareMemo, fail, getProjectId, respond } from "@/utils.ts";
import { promptForCost } from "./mod.ts";
import * as storage from "@/storage.ts";

interface AddMemoOpts {
    name: string;
    expense?: boolean;
    project?: string;
    description?: string;
    cost?: string;
}

const action = async (name: string, { expense, project, description, cost }: AddMemoOpts, cmd: Command) => {
    const isStructured = (cmd.optsWithGlobals() as Record<string, unknown>).structured;

    return await match(await getProjectId(project), {
        Err: (msg: string) => fail(cmd, msg),
        Ok: async (proj: string) => {
            let note: BareMemo = { name, type: "kv" };

            // Handle description flag
            if (description !== undefined) {
                note.description = description || undefined;
            } else if (!isStructured) {
                note.description = await Input.prompt({
                    message: "Memo description (optional, leave blank for none):",
                });
            }

            // Handle cost / expense flags
            if (cost !== undefined) {
                const costNum = Number(cost);
                if (isNaN(costNum)) fail(cmd, `Invalid cost: "${cost}". Must be a number.`);
                note = { ...note, type: "expense", cost: costNum };
            } else if (expense) {
                if (isStructured) {
                    fail(cmd, "--cost <number> is required for expenses in structured mode.");
                }
                const c = await promptForCost();
                note = { ...note, type: "expense", cost: c };
            }

            const memo = await storage.createNote(proj, note);
            respond(cmd, (data) => {
                console.log(data.message);
            }, {
                message: `Memo '${name}' added to project '${proj}'.`,
                memo: { id: memo.id, name, type: note.type, project: proj },
            });
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
    .option("--description <text>", "Memo description. Skips interactive prompt.")
    .option("--cost <number>", "Expense cost. Implies --expense.")
    .description("Add a memo to a project.")
    .action(action);
