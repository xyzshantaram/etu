import { Command } from '@/commander';

import { config } from "./commands/config/mod.ts";
import { log } from "./commands/log/mod.ts";
import { session } from "./commands/session/mod.ts";
import { project } from "./commands/project/mod.ts";

const createEtu = () => {
    const etu = new Command();

    etu
        .name('etu')
        .description('A simple time-tracker application.')
        .version('0.0.1')
        .showHelpAfterError();

    [config, log, session, project].forEach(cmd => etu.addCommand(cmd));

    return etu;
}

if (import.meta.main) {
    const etu = createEtu();
    etu.parse(Deno.args, { from: "user" });
}