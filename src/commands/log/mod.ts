import { Command } from "commander";
import { match } from "@/oxide";
import { getProjectId, scream } from "../../utils.ts";
import { gatherLogData } from "./utils/gather.ts";
import { renderLogLiquid } from "./utils/render-liquid.ts";
import { renderLogTerminal } from "./utils/render-terminal.ts";

interface ESummaryOpts {
    short: boolean;
    project: string;
    timeOnly: boolean;
    days: boolean;
    template?: string;
}

const action = async (opts: ESummaryOpts) => {
    return match(await getProjectId(opts.project), {
        Err: (msg: string) => scream(msg),
        Ok: async (id: string) => {
            const data = await gatherLogData(id);
            if (opts.template) {
                await renderLogLiquid(data, { template: opts.template });
            } else {
                renderLogTerminal(data, {
                    short: opts.short,
                    timeOnly: opts.timeOnly,
                    days: opts.days,
                });
            }
        },
    });
};

export const log = new Command("log")
    .option(
        "-p --project <string>",
        "id of the project to summarize. Uses the default if not specified.",
    )
    .option("--time-only", "Print only the total hours worked.")
    .option(
        "-s --short",
        "Don't print the log of hours worked. If used in conjunction with --time-only, prints the time in a short format ([xx]h[yy]m[zz]s).",
    )
    .option("-d --days", "Group hours by day instead of session")
    .option(
        "--template <name>",
        "Render using a named HTML template if it exists in your data/templates directory.",
    )
    .description(
        "Print the summary (hours worked, total billing) of the project.",
    )
    .action(action);
