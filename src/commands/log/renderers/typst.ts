import { NodeCompiler } from "@myriaddreamin/typst-ts-node-compiler";
import { scream } from "@/utils.ts";
import type { LogData } from "@/commands/log/utils/gather.ts";
import { findTemplate } from "@/commands/log/utils/template-discovery.ts";
import type { OutputFormat, RenderOptions, RenderResult, TemplateRenderer } from "./types.ts";

export class TypstRenderer implements TemplateRenderer {
    readonly type = "typst" as const;
    readonly defaultFormat = "pdf" as const;

    private compiler: NodeCompiler | null = null;

    async render(data: LogData, options: RenderOptions): Promise<RenderResult> {
        const { templateName, format = this.defaultFormat } = options;

        const template = await findTemplate(templateName);
        if (!template || template.type !== "typst") {
            scream(
                `A template file with name '${templateName}.typ' could not be found. ` +
                    `Please make sure it is present in your templates directory.`,
            );
        }

        let mainFileContent: string;
        try {
            mainFileContent = await Deno.readTextFile(template!.path);
        } catch (e) {
            if (e instanceof Deno.errors.NotFound) {
                scream(`Template '${templateName}' not found at ${template!.path}`);
            } else {
                scream(`Error reading template: ${e}`);
            }
        }
        const inputs = this.prepareInputs(data);
        const content = await this.compile(mainFileContent!, inputs, format);

        return {
            content,
            format,
            stdout: format === "html",
        };
    }

    private prepareInputs(data: LogData): Record<string, string> {
        return {
            ctx: JSON.stringify({ ...data, now: Date.now() }),
        };
    }

    private compile(
        mainFileContent: string,
        inputs: Record<string, string>,
        format: OutputFormat,
    ): Promise<Uint8Array | string> {
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
                const result = this.compiler.pdf({ mainFileContent, inputs });
                return Promise.resolve(result);
            }
            case "html": {
                const result = this.compiler.svg({ mainFileContent, inputs });
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
