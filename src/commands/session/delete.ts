import { Command } from "commander";
import { Select } from "@cliffy/prompt";
import { match } from "@/oxide";
import { fail, getProjectId, respond } from "@/utils.ts";
import { getSessionChoices } from "./mod.ts";
import { Confirm } from "@cliffy/prompt";
import * as storage from "@/storage.ts";

interface EEditSessionOpts {
    project: string;
    sessionId?: string;
    yes?: boolean;
}

const action = async ({ project, sessionId, yes }: EEditSessionOpts, cmd: Command) => {
    const isStructured = (cmd.optsWithGlobals() as Record<string, unknown>).structured;

    return await match(await getProjectId(project), {
        Err: (msg: string) => fail(cmd, msg),
        Ok: async (id: string) => {
            const { choices, map } = await getSessionChoices(id);

            let toDelete: string;
            if (sessionId) {
                if (!map[sessionId]) {
                    fail(cmd, `Session ${sessionId} does not exist in project ${id}.`);
                }
                toDelete = sessionId;
            } else if (isStructured) {
                fail(cmd, "--session-id <ulid> is required in structured mode.");
            } else {
                toDelete = await Select.prompt({
                    message: "Which session do you want to delete?",
                    options: choices,
                    transform: (v) => map[v].ulid,
                });
            }

            if (isStructured && !yes) {
                fail(cmd, "--yes is required in structured mode for deletion.");
            }
            const confirmed = yes ||
                await Confirm.prompt({ message: "Are you sure you want to delete this session?" });

            if (confirmed) {
                await storage.deleteSession(id, toDelete);
                respond(cmd, (data) => {
                    console.log(data.message);
                }, {
                    message: "Session deleted.",
                    deletedSessionId: toDelete,
                });
            }
        },
    });
};

export const deleteSession = new Command("delete")
    .option(
        "-p --project <string>",
        "id of the project whose session to delete. uses default project if not specified.",
    )
    .description("Delete a session of a project.")
    .option("--session-id <ulid>", "ULID of the session to delete. Skips interactive selection.")
    .option("--yes", "Skip confirmation prompt.")
    .action(action);
