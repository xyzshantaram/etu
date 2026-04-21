import { NodeCompiler } from "@myriaddreamin/typst-ts-node-compiler";
import { scream } from "../../../utils.ts";
import type { LogData } from "../utils/gather.ts";
import type { OutputFormat, RenderOptions, RenderResult, TemplateRenderer } from "./types.ts";

/**
 * Typst template renderer
 * Outputs PDF by default
 */
export class TypstRenderer implements TemplateRenderer {
    readonly type = "typst" as const;
    readonly defaultFormat = "pdf" as const;

    private compiler: NodeCompiler | null = null;

    async render(data: LogData, options: RenderOptions): Promise<RenderResult> {
        const { templateName, format = this.defaultFormat } = options;

        // Find template file
        const templatePath = await this.findTemplate(templateName) ??
            scream(
                `A template file with name '${templateName}.typ' could not be found. ` +
                    `Please make sure it is present in your templates directory.`,
            );

        // Read template
        const mainFileContent = await Deno.readTextFile(templatePath);

        // Prepare inputs - convert LogData to JSON strings for Typst
        const inputs = this.prepareInputs(data);

        // Compile based on format
        const content = await this.compile(mainFileContent, inputs, format);

        // Determine if output should go to stdout
        // HTML can go to stdout, but PDF/PNG should go to file
        const stdout = format === "html";

        return {
            content,
            format,
            stdout,
        };
    }

    private async findTemplate(name: string): Promise<string | null> {
        const { findTemplate } = await import("../utils/template-discovery.ts");
        const template = await findTemplate(name);

        if (template?.type === "typst") {
            return template.path;
        }

        return null;
    }

    private prepareInputs(data: LogData): Record<string, string> {
        // Helper to format timestamps for display
        const formatTimestamp = (ms: number): string => {
            const date = new Date(ms);
            return date.toISOString().slice(0, 16).replace("T", " ");
        };

        // Add formatted dates to sessions
        const sessionsWithDates = data.sessions.map((session) => ({
            ...session,
            startFormatted: formatTimestamp(session.start),
            endFormatted: session.end ? formatTimestamp(session.end) : null,
        }));

        // Build a single context object with all data
        const context = {
            project: data.project,
            sessions: sessionsWithDates,
            time: data.time,
            ongoingTime: data.ongoingTime,
            currency: data.currency,
            currentSession: data.currentSession
                ? {
                    ...data.currentSession,
                    startFormatted: formatTimestamp(data.currentSession.start),
                }
                : null,
            elapsed: data.elapsed,
            decimalHours: data.decimalHours,
            gross: data.gross,
            advanceRemaining: data.advanceRemaining,
            finalAmount: data.finalAmount,
            hoursExpr: data.hoursExpr,
            memos: data.memos,
            totalExpenses: data.totalExpenses,
            finalWithExpenses: data.finalWithExpenses,
            sessionsByDay: data.sessionsByDay,
            now: Date.now(),
        };

        // Return a single 'ctx' input containing everything
        return {
            ctx: JSON.stringify(context),
        };
    }

    private compile(
        mainFileContent: string,
        inputs: Record<string, string>,
        format: OutputFormat,
    ): Promise<Uint8Array | string> {
        // Initialize compiler if needed
        if (!this.compiler) {
            try {
                this.compiler = NodeCompiler.create();
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                if (errorMsg.includes("ffi") || errorMsg.includes("FFI")) {
                    scream(
                        "Typst compiler requires FFI permissions. " +
                            "Please run with the --allow-ffi flag, or rebuild with: deno task build",
                    );
                }
                throw error;
            }
        }

        switch (format) {
            case "pdf": {
                const result = this.compiler.pdf({
                    mainFileContent,
                    inputs,
                });
                return Promise.resolve(result);
            }
            case "html": {
                // Typst doesn't natively support HTML, but we can use SVG
                // For now, we'll compile to SVG and return it as HTML-embeddable
                const result = this.compiler.svg({
                    mainFileContent,
                    inputs,
                });
                // Wrap SVG in minimal HTML for display
                return Promise.resolve(`<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Typst Output</title>
    <style>
        body { margin: 0; padding: 20px; display: flex; justify-content: center; }
        svg { max-width: 100%; height: auto; }
    </style>
</head>
<body>
    ${result}
</body>
</html>`);
            }
            case "png":
                throw new Error("PNG output not implemented yet");
            default:
                return scream(`Unsupported output format: ${format}`);
        }
    }
}
