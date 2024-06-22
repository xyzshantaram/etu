import { Command } from "@commander";
import { Maybe } from "../utils.ts";

interface EStartOpts {
    id: string;
}

const action = (name: Maybe<string>, { id }: EStartOpts) => {
    console.log(name, id);
}

export const startClock = (cmd: Command) => {
    return cmd.command('start')
        .option('-i --id <string>', 'id of the project to start. Uses the default if not specified.')
        .argument('[session-name]', 'Optional name for the session.')
        .description('Start the clock.')
        .action(action);
}