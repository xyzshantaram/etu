import { Command } from "@commander";

interface ESummaryOpts {
    log: boolean;
    id: string;
}

const action = ({ log, id }: ESummaryOpts) => {
    console.log(log, id);
}

export const summary = (cmd: Command) => {
    return cmd.command('summary')
        .option('-i --id <string>', 'id of the project to summarize. Uses the default if not specified.')
        .option('--no-log', "Don't print the log of hours worked.")
        .description('Print the summary (hours worked, total billing) of the project.')
        .action(action);
}
