import { Command } from "@commander";

interface ELogOpts {
    id: string
}

const action = ({ id }: ELogOpts) => {

}

export const log = (cmd: Command) => {
    return cmd.command('log')
        .option('-i --id <string>', 'id of the project to print the log for. Uses the default if not specified.')
        .description('Print the log (every session) of the project.')
        .action(action);
}