import { Command } from "@/commander";
import { EtuStorage } from "../storage.ts";
import { match } from "@/oxide";

const action = async (id: string) => {
    match(await EtuStorage.setDefaultProject(id), {
        Ok: _ => { },
        Err: msg => { throw new Error(msg) }
    });
}

export const setDefault = (cmd: Command) => {
    return cmd.command('default')
        .argument('<id>', 'id of the project to set as default.')
        .description('Change the default project.')
        .action(action);
}