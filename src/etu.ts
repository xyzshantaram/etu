import { Command } from '@/commander';
import { create } from "./commands/new.ts";
import { startClock } from "./commands/start.ts";
import { stopClock } from "./commands/stop.ts";
import { summary } from "./commands/summary.ts";
import { setDefault } from "./commands/default.ts";

const createEtu = () => {
    const etu = new Command();

    etu
        .name('etu')
        .description('A simple time-tracker application.')
        .version('0.0.1')
        .showHelpAfterError();

    [create, startClock, stopClock, summary, setDefault]
        .forEach(setup => setup(etu));

    return etu;
}

if (import.meta.main) {
    const etu = createEtu();
    etu.parse(Deno.args, { from: "user" });
}