import { Command } from "@/commander";
import * as storage from "../../storage.ts";
import { match } from "@/oxide";
import { scream } from "../../utils.ts";

const action = async (id: string) => {
    match(await storage.setDefaultProject(id), {
        Ok: (_) => {
            console.log(`Successfully set default project to \`${id}\`.`);
        },
        Err: (msg) => scream(msg),
    });
};

export const setDefault = new Command("default")
    .argument("<id>", "id of the project to set as default.")
    .description("Change the default project.")
    .action(action);
