import * as path from "@std/path";
import { Select } from "@cliffy/prompt";
import * as storage from "@/storage.ts";
import { getDocumentsDir } from "@/utils.ts";
import type { OutputFormat } from "@/commands/log/renderers/types.ts";
import { scream } from "@/utils.ts";

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
    options: { outputPath?: string; outputDir?: string; currentDir?: boolean },
    projectSlug: string,
    format: OutputFormat,
): Promise<string | null> {
    if (options.outputPath) return options.outputPath;
    if (format === "html" && !options.outputDir && !options.currentDir) return null;

    let directory: string;
    if (options.currentDir) {
        directory = Deno.cwd();
    } else if (options.outputDir) {
        directory = options.outputDir;
    } else {
        directory = await promptForOutputLocation();
    }

    await Deno.mkdir(directory, { recursive: true });
    return path.join(directory, generateFilename(projectSlug, format));
}

async function promptForOutputLocation(): Promise<string> {
    const outputDir = await getOutputDir();
    const currentDir = Deno.cwd();

    const choice = await Select.prompt({
        message: "Where would you like to save the output?",
        options: [
            { name: `Output directory (${outputDir})`, value: "output-dir" },
            { name: `Current directory (${currentDir})`, value: "current-dir" },
        ],
    });

    return choice === "output-dir" ? outputDir : currentDir;
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
