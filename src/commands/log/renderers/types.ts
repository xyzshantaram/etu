import type { LogData } from "@/commands/log/utils/gather.ts";

export type OutputFormat = "html" | "pdf" | "png";
export type TemplateType = "liquid" | "typst";

export interface RenderOptions {
    templateName: string;
    format?: OutputFormat;
}

export interface RenderResult {
    content: string | Uint8Array;
    format: OutputFormat;
    stdout: boolean;
}

export interface TemplateRenderer {
    readonly type: TemplateType;
    readonly defaultFormat: OutputFormat;
    render(data: LogData, options: RenderOptions): Promise<RenderResult>;
}
