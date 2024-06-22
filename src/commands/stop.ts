import { Command } from "@commander";

interface EStopOpts {
    id: string;
}

const action = ({ id }: EStopOpts) => {

}

export const stopClock = (cmd: Command) => {
    return cmd.command('stop')
        .option('-i --id <string>', 'id of the project to stop. Uses the default if not specified.')
        .description('Stop the clock.')
        .action(action);
}
