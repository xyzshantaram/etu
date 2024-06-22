import { Command } from "@/commander";
import * as storage from "../../storage.ts";
import { match } from "@/oxide";

const action = async (id: string) => {
    match(await storage.setDefaultProject(id), {
        Ok: _ => { },
        Err: msg => { throw new Error(msg) }
    });
}

export const setDefault = new Command('default')
    .argument('<id>', 'id of the project to set as default.')
    .description('Change the default project.')
    .action(action);