import { Command } from "@/commander";
import { match } from "@/oxide";
import { EtuStorage } from "../storage.ts";
import { getProjectId } from "../utils.ts";

interface EStopOpts {
    id: string;
}

const action = async ({ id }: EStopOpts) => {
    return await match(await getProjectId(id), {
        Err: (msg: string) => { throw new Error(msg) },
        Ok: async (id: string) => { await EtuStorage.endSession(id, new Date().valueOf()) }
    });
}

export const stopClock = (cmd: Command) => {
    return cmd.command('stop')
        .option('-i --id <string>', 'id of the project to stop. Uses the default if not specified.')
        .description('Stop the clock.')
        .action(action);
}
