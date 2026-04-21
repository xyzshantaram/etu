import type { LogData } from "../utils/gather.ts";

/**
 * Output format for rendered templates
 */
export type OutputFormat = "html" | "pdf" | "png";

/**
 * Template type based on file extension
 */
export type TemplateType = "liquid" | "typst";

/**
 * Options for rendering a template
 */
export interface RenderOptions {
    /** The name of the template (without extension) */
    templateName: string;
    /** Output format (html, pdf, png) */
    format?: OutputFormat;
    /** Explicit output file path */
    outputPath?: string;
    /** Output directory (overrides config) */
    outputDir?: string;
    /** Save in current directory without prompt */
    currentDir?: boolean;
}

/**
 * Result of rendering a template
 */
export interface RenderResult {
    /** The rendered content (for stdout or file writing) */
    content: string | Uint8Array;
    /** The output format used */
    format: OutputFormat;
    /** Whether output should go to stdout (vs file) */
    stdout: boolean;
    /** Suggested filename if writing to file */
    suggestedFilename?: string;
}

/**
 * Interface that all template renderers must implement
 */
export interface TemplateRenderer {
    /**
     * The type of templates this renderer handles
     */
    readonly type: TemplateType;

    /**
     * The default output format for this renderer
     */
    readonly defaultFormat: OutputFormat;

    /**
     * Render a template with the given data
     * @param data The log data to render
     * @param options Rendering options
     * @returns The rendered result
     */
    render(data: LogData, options: RenderOptions): Promise<RenderResult>;
}
