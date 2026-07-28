import { Command } from "commander";
import { match } from "@/oxide";
import { fail, getProjectId, info, respond, success } from "@/utils.ts";
import { gatherLogData } from "./utils/gather.ts";
import { renderLogTerminal } from "./utils/render-terminal.ts";
import { findTemplate } from "./utils/template-discovery.ts";
import { LiquidRenderer } from "./renderers/liquid.ts";
import { TypstRenderer } from "./renderers/typst.ts";
import { openWithSystemViewer, resolveOutputPath, writeOutput } from "./utils/output.ts";
import type { OutputFormat, TemplateRenderer } from "./renderers/types.ts";
import * as storage from "@/storage.ts";

interface ESummaryOpts {
    short: boolean;
    project: string;
    timeOnly: boolean;
    days: boolean;
    template?: string;
    format?: string;
    output?: string;
    outputDir?: string;
}

const action = async (opts: ESummaryOpts, cmd: Command) => {
    return match(await getProjectId(opts.project), {
        Err: (msg: string) => fail(cmd, msg),
        Ok: async (id: string) => {
            const data = await gatherLogData(id);

            if ((cmd.optsWithGlobals() as Record<string, unknown>).structured) {
                respond(cmd, () => {}, data);
                return;
            }

            if (opts.template) {
                const templateInfo = await findTemplate(opts.template) ??
                    fail(
                        cmd,
                        `Template '${opts.template}' not found. ` +
                            `Please ensure it exists in your templates directory as ` +
                            `'${opts.template}.liquid' or '${opts.template}.typ'.`,
                    );

                const renderer: TemplateRenderer = templateInfo.type === "liquid"
                    ? new LiquidRenderer()
                    : new TypstRenderer();

                let format: OutputFormat;
                if (opts.format) {
                    if (!["html", "pdf", "png"].includes(opts.format)) {
                        fail(cmd, `Invalid format: ${opts.format}. Must be one of: html, pdf, png`);
                    }
                    format = opts.format as OutputFormat;
                } else {
                    format = renderer.defaultFormat;
                }

                const project = (await storage.getProjectById(id)).unwrap();
                const result = await renderer.render(data, {
                    templateName: opts.template,
                    format,
                });

                if (result.stdout) {
                    if (typeof result.content === "string") {
                        console.log(result.content);
                    } else {
                        fail(cmd, "Cannot output binary content to stdout. Please specify an output file with -o.");
                    }
                } else {
                    const outputPath = await resolveOutputPath(
                        {
                            outputPath: opts.output,
                            outputDir: opts.outputDir,
                        },
                        project.slug,
                        format,
                    );

                    await writeOutput(outputPath, result.content);
                    console.log(success(`Output saved to:`), outputPath);

                    if (format === "pdf") {
                        await openWithSystemViewer(outputPath);
                    }
                }
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
    .description(
        "Print the summary (hours worked, total billing) of the project.",
    )
    .option(
        "--template <name>",
        "Render using a template (without extension). Auto-detects .liquid or .typ format. " +
            "Liquid defaults to HTML output (stdout), Typst defaults to PDF output (file).",
    )
    .option(
        "--format <format>",
        "Output format: html, pdf, or png. Overrides template default.",
    )
    .option(
        "-o, --output <path>",
        "Output file path. Saves directly to this location.",
    )
    .option(
        "--output-dir <path>",
        "Output directory. Defaults to Documents/etu or the configured output-path.",
    )
    .action(action);
