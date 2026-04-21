import * as path from "@std/path";
import { dataPath } from "@/utils.ts";
import type { TemplateType } from "@/commands/log/renderers/types.ts";

export interface TemplateInfo {
    name: string;
    path: string;
    type: TemplateType;
    extension: string;
}

export async function findTemplate(name: string): Promise<TemplateInfo | null> {
    const templatesDir = path.join(dataPath, "templates");

    let liquidExists = false;
    let typstExists = false;
    const liquidPath = path.join(templatesDir, `${name}.liquid`);
    const typstPath = path.join(templatesDir, `${name}.typ`);

    try {
        await Deno.stat(liquidPath);
        liquidExists = true;
    } catch { /* not found */ }

    try {
        await Deno.stat(typstPath);
        typstExists = true;
    } catch { /* not found */ }

    if (liquidExists && typstExists) {
        console.warn(`Warning: both ${name}.liquid and ${name}.typ exist. Using ${name}.liquid.`);
    }

    if (liquidExists) {
        return { name, path: liquidPath, type: "liquid", extension: ".liquid" };
    }
    if (typstExists) {
        return { name, path: typstPath, type: "typst", extension: ".typ" };
    }

    return null;
}

export async function listTemplates(): Promise<TemplateInfo[]> {
    const templatesDir = path.join(dataPath, "templates");
    const templates: TemplateInfo[] = [];

    try {
        for await (const entry of Deno.readDir(templatesDir)) {
            if (!entry.isFile) continue;

            const ext = path.extname(entry.name);
            const name = path.basename(entry.name, ext);

            let type: TemplateType | null = null;
            if (ext === ".liquid") type = "liquid";
            else if (ext === ".typ") type = "typst";

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
        return [];
    }

    return templates;
}
