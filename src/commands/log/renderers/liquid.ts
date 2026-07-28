import { Liquid } from "liquidjs";
import { humanReadable, scream } from "@/utils.ts";
import type { LogData } from "@/commands/log/utils/gather.ts";
import { findTemplate } from "@/commands/log/utils/template-discovery.ts";
import type { RenderOptions, RenderResult, TemplateRenderer } from "./types.ts";

export class LiquidRenderer implements TemplateRenderer {
    readonly type = "liquid" as const;
    readonly defaultFormat = "html" as const;

    async render(data: LogData, options: RenderOptions): Promise<RenderResult> {
        const { templateName, format = this.defaultFormat } = options;

        if (format !== "html") {
            scream(`Liquid templates only support HTML output. Got: ${format}`);
        }

        const template = await findTemplate(templateName);
        if (!template || template.type !== "liquid") {
            scream(
                `A template file with name '${templateName}.liquid' could not be found. ` +
                    `Please make sure it is present in your templates directory.`,
            );
        }

        let tpl: string;
        try {
            tpl = await Deno.readTextFile(template!.path);
        } catch (e) {
            if (e instanceof Deno.errors.NotFound) {
                scream(`Template '${templateName}' not found at ${template!.path}`);
            } else {
                scream(`Error reading template: ${e}`);
            }
        }

        const engine = new Liquid();
        engine.registerFilter("humanReadable", (ms: number) => humanReadable(ms, false));
        const html = await engine.parseAndRender(tpl!, { ...data, now: Date.now() });

        return {
            content: html,
            format: "html",
            stdout: true,
        };
    }
}
