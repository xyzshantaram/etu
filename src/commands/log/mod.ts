import { Command } from "commander";
import { match } from "@/oxide";
import { getProjectId, scream, success } from "../../utils.ts";
import { gatherLogData } from "./utils/gather.ts";
import { renderLogTerminal } from "./utils/render-terminal.ts";
import { findTemplate } from "./utils/template-discovery.ts";
import { LiquidRenderer } from "./renderers/liquid.ts";
import { TypstRenderer } from "./renderers/typst.ts";
import { resolveOutputPath, writeOutput } from "./utils/output.ts";
import type { OutputFormat, TemplateRenderer } from "./renderers/types.ts";
import * as storage from "../../storage.ts";

interface ESummaryOpts {
    short: boolean;
    project: string;
    timeOnly: boolean;
    days: boolean;
    template?: string;
    json?: boolean;
    format?: string;
    output?: string;
    outputDir?: string;
    currentDir?: boolean;
}

const action = async (opts: ESummaryOpts) => {
    return match(await getProjectId(opts.project), {
        Err: (msg: string) => scream(msg),
        Ok: async (id: string) => {
            // If JSON output requested, print and exit
            if (opts.json) {
                const data = await gatherLogData(id);
                console.log(JSON.stringify(data, null, 2));
                return;
            }

            const data = await gatherLogData(id);

            // If template specified, use renderer system
            if (opts.template) {
                // Find the template
                const templateInfo = await findTemplate(opts.template) ??
                    scream(
                        `Template '${opts.template}' not found. ` +
                        `Please ensure it exists in your templates directory as ` +
                        `'${opts.template}.liquid' or '${opts.template}.typ'.`
                    );

                // Get the appropriate renderer
                const renderer: TemplateRenderer = templateInfo.type === "liquid"
                    ? new LiquidRenderer()
                    : new TypstRenderer();

                // Determine output format
                let format: OutputFormat;
                if (opts.format) {
                    // Validate format
                    if (!["html", "pdf", "png"].includes(opts.format)) {
                        scream(`Invalid format: ${opts.format}. Must be one of: html, pdf, png`);
                    }
                    format = opts.format as OutputFormat;
                } else {
                    // Use renderer's default format
                    format = renderer.defaultFormat;
                }

                // Get project for filename generation
                const project = (await storage.getProjectById(id)).unwrap();

                // Render the template
                const result = await renderer.render(data, {
                    templateName: opts.template,
                    format,
                    outputPath: opts.output,
                    outputDir: opts.outputDir,
                    currentDir: opts.currentDir,
                });

                // Handle output
                if (result.stdout) {
                    // Output to stdout
                    if (typeof result.content === "string") {
                        console.log(result.content);
                    } else {
                        scream("Cannot output binary content to stdout. Please specify an output file with -o.");
                    }
                } else {
                    // Write to file
                    const outputPath = await resolveOutputPath(
                        {
                            templateName: opts.template,
                            format,
                            outputPath: opts.output,
                            outputDir: opts.outputDir,
                            currentDir: opts.currentDir,
                        },
                        project.slug,
                        format,
                    );

                    const resolvedPath = outputPath ??
                        scream("Failed to determine output path.");

                    await writeOutput(resolvedPath, result.content);
                    console.log(success(`Output written to: ${resolvedPath}`));
                }
            } else {
                // No template - use terminal renderer (existing behavior)
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
    .option("--json", "Output all project log data as JSON.")
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
        "Output file path. Skips prompts and saves directly to this location.",
    )
    .option(
        "--output-dir <path>",
        "Output directory. Uses this instead of the configured output-path.",
    )
    .option(
        "--current-dir",
        "Save output in current directory without prompting.",
    )
    .action(action);
