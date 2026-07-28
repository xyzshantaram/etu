import { Command } from "commander";
import { Confirm, Input, Select, SelectOption } from "@cliffy/prompt";
import { match } from "@/oxide";
import { BareMemo, fail, getProjectId, Memo, respond, success } from "@/utils.ts";
import * as storage from "@/storage.ts";
import { promptForCost } from "./mod.ts";

interface EditMemoOpts {
    project?: string;
    memoId?: string;
    rename?: string;
    description?: string;
    type?: string;
    cost?: string;
}

const action = async ({ project, memoId, rename, description, type, cost }: EditMemoOpts, cmd: Command) => {
    const isStructured = (cmd.optsWithGlobals() as Record<string, unknown>).structured;

    return await match(await getProjectId(project), {
        Err: (msg: string) => fail(cmd, msg),
        Ok: async (proj: string) => {
            const notes = await storage.getProjectNotes(proj);

            let toEdit: Memo;
            if (memoId) {
                const found = notes.find((n) => n.id === memoId);
                if (!found) fail(cmd, `Memo ${memoId} not found in project ${proj}.`);
                toEdit = found;
            } else if (isStructured) {
                fail(cmd, "--memo-id <id> is required in structured mode.");
            } else {
                if (!notes.length) return console.log("No memos to edit.");
                const noteOpts: SelectOption<Memo>[] = notes.map((itm) => ({
                    value: itm,
                    name: itm.name,
                }));

                toEdit = await Select.prompt({
                    message: "Which memo do you want to edit?",
                    options: noteOpts,
                });
            }

            const hasFlags = rename !== undefined || description !== undefined ||
                type !== undefined || cost !== undefined;

            if (isStructured && !hasFlags) {
                fail(
                    cmd,
                    "--rename, --description, --type, and/or --cost is required in structured mode.",
                );
            }

            if (hasFlags) {
                let updated: BareMemo;
                if (toEdit.type === "expense") {
                    updated = { name: toEdit.name, type: "expense", cost: toEdit.cost };
                } else {
                    updated = { name: toEdit.name, type: "kv" };
                }
                if (toEdit.description) updated.description = toEdit.description;

                // Apply flag-based changes
                if (rename !== undefined) {
                    updated = { ...updated, name: rename || toEdit.name };
                }
                if (description !== undefined) {
                    updated = { ...updated, description: description || undefined };
                }
                if (type !== undefined) {
                    if (type === "expense" && updated.type !== "expense") {
                        // Converting to expense: need a cost
                        if (cost !== undefined) {
                            const costNum = Number(cost);
                            if (isNaN(costNum)) fail(cmd, `Invalid cost: "${cost}". Must be a number.`);
                            updated = { name: updated.name, type: "expense", cost: costNum };
                            if (updated.description !== undefined) {
                                updated = { ...updated, description: updated.description } as BareMemo;
                            }
                        } else if (isStructured) {
                            fail(
                                cmd,
                                "--cost <number> is required when converting to expense type in structured mode.",
                            );
                        } else {
                            // In text mode with flags, also fail since we can't prompt
                            fail(cmd, "--cost <number> is required when using --type expense.");
                        }
                    } else if (type === "expense" && updated.type === "expense" && cost !== undefined) {
                        // Already expense, updating cost
                        const costNum = Number(cost);
                        if (isNaN(costNum)) fail(cmd, `Invalid cost: "${cost}". Must be a number.`);
                        updated = { ...updated, type: "expense", cost: costNum } as BareMemo;
                    } else if (type === "kv" && updated.type !== "kv") {
                        const desc = updated.description;
                        updated = { name: updated.name, type: "kv" };
                        if (desc) updated = { ...updated, description: desc } as BareMemo;
                    } else if (type !== "kv" && type !== "expense") {
                        fail(cmd, `Invalid type: "${type}". Must be "kv" or "expense".`);
                    }
                    // If same type, no change needed for type conversion
                }
                if (cost !== undefined && type === undefined) {
                    // Standalone --cost flag: update cost on an existing expense
                    if (updated.type !== "expense") {
                        fail(
                            cmd,
                            "Cannot set cost on a non-expense memo. Use --type expense --cost <number> to convert.",
                        );
                    }
                    const costNum = Number(cost);
                    if (isNaN(costNum)) fail(cmd, `Invalid cost: "${cost}". Must be a number.`);
                    updated = { ...updated, type: "expense", cost: costNum } as BareMemo;
                }

                await storage.deleteNote(proj, toEdit.id);
                await storage.createNote(proj, updated);
                respond(cmd, (data) => {
                    console.log(data.message);
                }, {
                    message: "Memo updated.",
                    memo: { name: updated.name, type: updated.type },
                });
                return;
            }

            // Interactive loop (existing behaviour)
            const actionOpts = [{
                value: "desc",
                name: "Change description",
            }, {
                value: "name",
                name: "Change memo name",
            }, {
                value: "type",
                name: "Change memo type (note/expense)",
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

            let updated: BareMemo;
            if (toEdit.type === "expense") {
                updated = { name: toEdit.name, type: "expense", cost: toEdit.cost };
            } else {
                updated = { name: toEdit.name, type: "kv" };
            }
            if (toEdit.description) updated.description = toEdit.description;

            switch (update) {
                case "desc": {
                    const desc = await Input.prompt({
                        message: `New description (leave blank to keep current).`,
                    });
                    updated.description = desc || toEdit.description;
                    break;
                }
                case "name": {
                    const name = await Input.prompt({ message: `New name (leave blank to keep '${toEdit.name}'):` });
                    updated.name = name || toEdit.name;
                    break;
                }
                case "type": {
                    const newType = await Select.prompt({
                        message: "Select new memo type:",
                        options: [
                            { value: "kv", name: "Note" },
                            { value: "expense", name: "Expense" },
                        ],
                    });

                    if (newType === toEdit.type) {
                        console.log("Memo type is already that.");
                        return;
                    }

                    if (newType === "expense") {
                        const c = await promptForCost();
                        updated = { name: updated.name, type: "expense", cost: c };
                        if (toEdit.description) updated.description = toEdit.description;
                    } else {
                        if (toEdit.type === "expense") {
                            console.log(`${success("Removing expense amount:")} ${toEdit.cost}`);
                        }
                        updated = { name: updated.name, type: "kv" };
                        if (toEdit.description) updated.description = toEdit.description;
                    }
                    break;
                }
                case "cost": {
                    if (toEdit.type !== "expense") {
                        fail(cmd, "Error: invalid note type for cost edit. This is an etu bug");
                    }
                    const c = await promptForCost(toEdit.cost);
                    updated = { name: updated.name, type: "expense", cost: c };
                    if (toEdit.description) updated.description = toEdit.description;
                    break;
                }
            }

            if (await Confirm.prompt({ message: "Save changes?" })) {
                await storage.deleteNote(proj, toEdit.id);
                await storage.createNote(proj, updated);
                respond(cmd, (data) => {
                    console.log(data.message);
                }, {
                    message: "Memo updated.",
                    memo: { name: updated.name, type: updated.type },
                });
            } else {
                console.log("Edit cancelled.");
            }
        },
    });
};

export const edit = new Command("edit")
    .option("-p --project <project>", "id of the project whose memo to edit. uses default project if not specified.")
    .description("Edit a memo (note or expense) of a project.")
    .option("--memo-id <id>", "ID of the memo to edit. Skips interactive selection.")
    .option("--rename <name>", "New memo name.")
    .option("--description <text>", "New description.")
    .option("--type <type>", "Memo type: kv or expense.")
    .option("--cost <number>", "New expense cost (only with --type expense).")
    .action(action);
