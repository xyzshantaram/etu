import { Command } from "commander";

import { config, setupDefaults } from "./commands/config/mod.ts";
import { log } from "./commands/log/mod.ts";
import { session } from "./commands/session/mod.ts";
import { project } from "./commands/project/mod.ts";
import { status } from "./commands/status/mod.ts";
import { memo } from "./commands/memo/mod.ts";

export const createEtu = () => {
    const etu = new Command();

    etu
        .name("etu")
        .description("A simple time-tracker application.")
        .version("0.0.1")
        .showHelpAfterError();

    [config, log, session, project, status, memo].forEach((cmd) => etu.addCommand(cmd));

    return etu;
};

if (import.meta.main) {
    const etu = createEtu();
    await setupDefaults();
    etu.parse(Deno.args, { from: "user" });
}
