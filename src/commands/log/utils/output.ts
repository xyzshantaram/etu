import * as path from "@std/path";
import { Select } from "@cliffy/prompt";
import * as storage from "../../../storage.ts";
import { dir } from "@cross/dir";
import type { OutputFormat, RenderOptions } from "../renderers/types.ts";
import { scream } from "../../../utils.ts";

export const getDocumentsDir = async () => {
    const documentsDir = await dir("document").catch(() => null);
    if (documentsDir && documentsDir.trim().length) return documentsDir.trim();

    const homeDir = await dir("home").catch(() => null);
    if (!homeDir) {
        scream("Couldn't find your home directory! Bailing.");
    }
    const p = path.join(homeDir || ".", "Documents");
    await Deno.mkdir(p, { recursive: true });
    return p;
};

/**
 * Get the default output directory from config or use default
 */
export async function getOutputDir(): Promise<string> {
    const configPath = await storage.getConfigValue("output-path");
    if (configPath) {
        return configPath;
    }

    const documentsDir = await getDocumentsDir();
    return path.join(documentsDir, "etu");
}

/**
 * Generate a timestamped filename
 */
export function generateFilename(projectSlug: string, format: OutputFormat): string {
    const now = new Date();
    const timestamp = now.toISOString()
        .replace(/[:.]/g, "-")
        .replace("T", "-")
        .slice(0, 19); // YYYY-MM-DD-HH-MM-SS

    const ext = format === "html" ? "html" : format;
    return `${projectSlug}-log_export-${timestamp}.${ext}`;
}

/**
 * Resolve the output path based on options and user preferences
 * Returns null if output should go to stdout
 */
export async function resolveOutputPath(
    options: RenderOptions,
    projectSlug: string,
    format: OutputFormat,
): Promise<string | null> {
    // If explicit output path provided, use it
    if (options.outputPath) {
        return options.outputPath;
    }

    // If format is HTML and no explicit output, use stdout
    if (format === "html" && !options.outputDir && !options.currentDir) {
        return null;
    }

    // For PDF/PNG, we need a file path
    let directory: string;

    if (options.currentDir) {
        // Use current directory
        directory = Deno.cwd();
    } else if (options.outputDir) {
        // Use provided output directory
        directory = options.outputDir;
    } else {
        // Prompt user for location
        directory = await promptForOutputLocation(projectSlug);
    }

    // Ensure directory exists
    await Deno.mkdir(directory, { recursive: true });

    // Generate filename
    const filename = generateFilename(projectSlug, format);
    return path.join(directory, filename);
}

/**
 * Prompt user to choose output location
 */
async function promptForOutputLocation(projectSlug: string): Promise<string> {
    const outputDir = await getOutputDir();
    const currentDir = Deno.cwd();

    const choice = await Select.prompt({
        message: "Where would you like to save the output?",
        options: [
            {
                name: `Output directory (${outputDir})`,
                value: "output-dir",
            },
            {
                name: `Current directory (${currentDir})`,
                value: "current-dir",
            },
        ],
    });

    return choice === "output-dir" ? outputDir : currentDir;
}

/**
 * Write content to a file
 */
export async function writeOutput(
    filepath: string,
    content: string | Uint8Array,
): Promise<void> {
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
