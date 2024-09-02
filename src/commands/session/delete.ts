import { Command } from "@/commander";
import { Select } from "@/cliffy/prompt";
import { match } from "@/oxide";
import { getProjectId, scream } from "../../utils.ts";
import { getSessionChoices } from "./mod.ts";
import { Confirm } from "@/cliffy/prompt";
import * as storage from "../../storage.ts";

interface EEditSessionOpts {
    project: string;
}

const action = async ({ project }: EEditSessionOpts) => {
    return await match(await getProjectId(project), {
        Err: (msg: string) => scream(msg),
        Ok: async (id: string) => {
            const { choices, map } = await getSessionChoices(id);

            const toDelete = await Select.prompt({
                message: "Which session do you want to delete?",
                options: choices,
                transform: (v) => map[v].ulid,
            });

            if (await Confirm.prompt({ message: "Are you sure you want to delete this session?" })) {
                await storage.deleteSession(id, toDelete);
            }
        },
    });
};

export const deleteSession = new Command("delete")
    .option("-p --project", "id of the project whose session to delete. uses default project if not specified.")
    .description("Delete a session of a project.")
    .action(action);
