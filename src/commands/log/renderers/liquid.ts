import { Liquid } from "liquidjs";
import { humanReadable, scream } from "../../../utils.ts";
import type { LogData } from "../utils/gather.ts";
import type { TemplateRenderer, RenderOptions, RenderResult } from "./types.ts";

/**
 * Liquid template renderer
 * Outputs HTML to stdout by default
 */
export class LiquidRenderer implements TemplateRenderer {
    readonly type = "liquid" as const;
    readonly defaultFormat = "html" as const;

    async render(data: LogData, options: RenderOptions): Promise<RenderResult> {
        const { templateName, format = this.defaultFormat } = options;

        // Liquid is an HTML engine — other formats are not supported
        if (format !== "html") {
            scream(`Liquid templates only support HTML output. Got: ${format}`);
        }

        // Find template file
        const templatePath = await this.findTemplate(templateName) ??
            scream(
                `A template file with name '${templateName}.liquid' could not be found. ` +
                `Please make sure it is present in your templates directory.`
            );

        // Read template
        const tpl = await Deno.readTextFile(templatePath);

        // Set up Liquid engine with custom filters
        const engine = new Liquid();
        engine.registerFilter("humanReadable", (ms: number) => humanReadable(ms, false));

        // Render template
        const context = { ...data, now: Date.now() };
        const html = await engine.parseAndRender(tpl, context);

        return {
            content: html,
            format: "html",
            stdout: true, // Liquid always outputs to stdout for backward compatibility
        };
    }

    private async findTemplate(name: string): Promise<string | null> {
        // Import here to avoid circular dependency
        const { findTemplate } = await import("../utils/template-discovery.ts");
        const template = await findTemplate(name);
        
        if (template?.type === "liquid") {
            return template.path;
        }
        
        return null;
    }
}
