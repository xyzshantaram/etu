import { Liquid } from "liquidjs";
import * as path from "@std/path";
import { dataPath, humanReadable, scream } from "../../../utils.ts";
import type { LogData } from "./gather.ts";

export interface LiquidRenderOpts {
    template: string;
}

export async function renderLogLiquid(data: LogData, { template }: LiquidRenderOpts) {
    const templatePath = path.join(dataPath, "templates", `${template}.liquid`);
    try {
        await Deno.stat(templatePath);
        const tpl = await Deno.readTextFile(templatePath);
        const engine = new Liquid();
        engine.registerFilter("humanReadable", (ms: number) => humanReadable(ms, false));
        const context = { ...data, now: Date.now() };
        const html = await engine.parseAndRender(tpl, context);
        console.log(html);
    } catch (e) {
        if (e instanceof Deno.errors.NotFound) {
            scream(`Template '${template}' not found at ${templatePath}`);
        } else {
            scream(`Error rendering template: ${e}`);
        }
    }
}
