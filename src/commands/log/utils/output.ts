import * as path from "@std/path";
import * as storage from "@/storage.ts";
import { getDocumentsDir, info } from "@/utils.ts";
import type { OutputFormat } from "@/commands/log/renderers/types.ts";

export async function getOutputDir(): Promise<string> {
    const configPath = await storage.getConfigValue("output-path");
    if (configPath) return configPath;
    const documentsDir = await getDocumentsDir();
    return path.join(documentsDir, "etu");
}

export function generateFilename(projectSlug: string, format: OutputFormat): string {
    const now = new Date();
    const timestamp = now.toISOString()
        .replace(/[:.]/g, "-")
        .replace("T", "-")
        .slice(0, 19);

    const ext = format === "html" ? "html" : format;
    return `${projectSlug}-log_export-${timestamp}.${ext}`;
}

export async function resolveOutputPath(
    options: { outputPath?: string; outputDir?: string },
    projectSlug: string,
    format: OutputFormat,
): Promise<string> {
    if (options.outputPath) return options.outputPath;

    const directory = options.outputDir ?? await getOutputDir();
    await Deno.mkdir(directory, { recursive: true });
    return path.join(directory, generateFilename(projectSlug, format));
}

export async function writeOutput(filepath: string, content: string | Uint8Array): Promise<void> {
    try {
        if (typeof content === "string") {
            await Deno.writeTextFile(filepath, content);
        } else {
            await Deno.writeFile(filepath, content);
        }
    } catch (error) {
        throw new Error(
            `Failed to write output file: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
}

export async function openWithSystemViewer(filepath: string): Promise<void> {
    const cmd = Deno.build.os === "darwin" ? "open" : Deno.build.os === "windows" ? "explorer" : "xdg-open";

    try {
        await new Deno.Command(cmd, { args: [filepath] }).spawn().output();
        return;
    } catch {
        console.log(info("Tip:"), `Open the file manually: ${filepath}`);
    }
}
