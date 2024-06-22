import { Command } from "@commander";

const action = (id: string) => {

}

export const setDefault = (cmd: Command) => {
    return cmd.command('default')
        .argument('<id>', 'id of the project to set as default.')
        .description('Change the default project.')
        .action(action);
}