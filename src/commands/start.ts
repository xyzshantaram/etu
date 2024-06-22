import { Command } from "@/commander";
import { Maybe, getProjectId } from "../utils.ts";
import { EtuStorage } from "../storage.ts";
import { match } from "@/oxide";

interface EStartOpts {
    id: string;
}

const action = async (name: Maybe<string>, { id }: EStartOpts) => {
    return match(await getProjectId(id), {
        Err: (msg: string) => { throw new Error(msg) },
        Ok: async (id: string) => {
            await EtuStorage.putSession(id, {
                name,
                start: new Date().valueOf()
            })
        }
    });
}

export const startClock = (cmd: Command) => {
    return cmd.command('start')
        .option('-i --id <string>', 'id of the project to start. Uses the default if not specified.')
        .argument('[session-name]', 'Optional name for the session.')
        .description('Start the clock.')
        .action(action);
}