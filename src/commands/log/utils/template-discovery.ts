import * as path from "@std/path";
import { dataPath } from "../../../utils.ts";
import type { TemplateType } from "../renderers/types.ts";

/**
 * Information about a discovered template
 */
export interface TemplateInfo {
    /** Template name (without extension) */
    name: string;
    /** Full path to template file */
    path: string;
    /** Template type based on extension */
    type: TemplateType;
    /** File extension */
    extension: string;
}

/**
 * Find a template by name in the templates directory
 * Looks for both .liquid and .typ extensions
 * @param name Template name (without extension)
 * @returns Template info if found, null otherwise
 */
export async function findTemplate(name: string): Promise<TemplateInfo | null> {
    const templatesDir = path.join(dataPath, "templates");
    
    // Try .liquid first (for backward compatibility)
    const liquidPath = path.join(templatesDir, `${name}.liquid`);
    try {
        await Deno.stat(liquidPath);
        return {
            name,
            path: liquidPath,
            type: "liquid",
            extension: ".liquid",
        };
    } catch {
        // Not found, try .typ
    }

    // Try .typ
    const typstPath = path.join(templatesDir, `${name}.typ`);
    try {
        await Deno.stat(typstPath);
        return {
            name,
            path: typstPath,
            type: "typst",
            extension: ".typ",
        };
    } catch {
        // Not found
    }

    return null;
}

/**
 * List all available templates in the templates directory
 * @returns Array of template info objects
 */
export async function listTemplates(): Promise<TemplateInfo[]> {
    const templatesDir = path.join(dataPath, "templates");
    const templates: TemplateInfo[] = [];

    try {
        for await (const entry of Deno.readDir(templatesDir)) {
            if (!entry.isFile) continue;

            const ext = path.extname(entry.name);
            const name = path.basename(entry.name, ext);

            let type: TemplateType | null = null;
            if (ext === ".liquid") {
                type = "liquid";
            } else if (ext === ".typ") {
                type = "typst";
            }

            if (type) {
                templates.push({
                    name,
                    path: path.join(templatesDir, entry.name),
                    type,
                    extension: ext,
                });
            }
        }
    } catch {
        // Directory doesn't exist or can't be read
        return [];
    }

    return templates;
}

/**
 * Ensure the templates directory exists
 */
export async function ensureTemplatesDir(): Promise<void> {
    const templatesDir = path.join(dataPath, "templates");
    try {
        await Deno.mkdir(templatesDir, { recursive: true });
    } catch {
        // Already exists or can't create
    }
}
