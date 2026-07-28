import { Command } from "commander";
import { Select, SelectOption } from "@cliffy/prompt";
import { match } from "@/oxide";
import { fail, getProjectId, Memo, respond } from "@/utils.ts";
import { Confirm } from "@cliffy/prompt";
import * as storage from "@/storage.ts";

interface EEditSessionOpts {
    project: string;
    memoId?: string;
    yes?: boolean;
}

const action = async ({ project, memoId, yes }: EEditSessionOpts, cmd: Command) => {
    const isStructured = (cmd.optsWithGlobals() as Record<string, unknown>).structured;

    return await match(await getProjectId(project), {
        Err: (msg: string) => fail(cmd, msg),
        Ok: async (proj: string) => {
            const notes = await storage.getProjectNotes(proj);

            let toDelete: Memo;
            if (memoId) {
                const found = notes.find((n) => n.id === memoId);
                if (!found) fail(cmd, `Memo ${memoId} not found in project ${proj}.`);
                toDelete = found;
            } else if (isStructured) {
                fail(cmd, "--memo-id <id> is required in structured mode.");
            } else {
                const options: SelectOption<Memo>[] = notes.map((itm) => ({
                    value: itm,
                    name: itm.name,
                }));

                toDelete = await Select.prompt({
                    message: "Which memo do you want to delete?",
                    options,
                });
            }

            if (isStructured && !yes) {
                fail(cmd, "--yes is required in structured mode for deletion.");
            }
            const confirmed = yes ||
                await Confirm.prompt({ message: "Are you sure you want to delete this note?" });

            if (confirmed) {
                await storage.deleteNote(proj, toDelete.id);
                respond(cmd, (data) => {
                    console.log(data.message);
                }, {
                    message: "Memo deleted.",
                    deletedMemoId: toDelete.id,
                });
            }
        },
    });
};

export const deleteMemo = new Command("delete")
    .option("-p --project <string>", "id of the project whose note to delete. uses default project if not specified.")
    .description("Delete a memo (note or expense) from a project.")
    .option("--memo-id <id>", "ID of the memo to delete. Skips interactive selection.")
    .option("--yes", "Skip confirmation prompt.")
    .action(action);
