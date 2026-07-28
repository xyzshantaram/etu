import { Command } from "commander";
import { fail, getDocumentsDir, info, Maybe, respond, success } from "@/utils.ts";
import * as storage from "@/storage.ts";

import * as path from "@std/path";

const documentsDir = await getDocumentsDir();
const defaultOutputPath = documentsDir ? path.join(documentsDir, "etu") : "";

const defaults = {
    "currency": "$",
    "output-path": defaultOutputPath,
};

const validKeys = Object.keys(defaults) as (keyof typeof defaults)[];

export const setupDefaults = async () => {
    for (const k of validKeys) {
        const v = await storage.getConfigValue(k);
        if (!v && typeof v !== "string") {
            await storage.setConfigValue(k, defaults[k]);
        }
    }
};

const isValidKey = (k: Maybe<string>): k is keyof typeof defaults => {
    return (validKeys as string[]).includes(k || "");
};

const action = async (key: Maybe<string>, value: Maybe<string>, _opts: unknown, cmd: Command) => {
    if (key && !isValidKey(key)) {
        fail(cmd, `${key} is not a valid configuration key.`);
    }

    if (key && value) {
        await storage.setConfigValue(key, value);
        respond(cmd, () => {
            console.log(success(`Successfully set ${key} to ${value}`));
        }, { key, value });
        return;
    } else if (key && !value) {
        const item = await storage.getConfigValue(key);
        respond(cmd, () => {
            console.log(`${key}: ${info(item)}`);
        }, { [key]: item });
        return;
    }
    // Print entire config
    const entries: Record<string, string> = {};
    for (const k of validKeys) {
        const v = await storage.getConfigValue(k);
        entries[k] = v === "" ? "<nothing>" : v;
    }
    respond(cmd, (data) => {
        for (const k of validKeys) {
            console.log(`${k}: ${info(data[k])}`);
        }
    }, entries);
};

export const config = new Command("config")
    .description(
        "Set/get configuration values. If neither key nor value is provided, prints the entire config.",
    )
    .argument(
        "[key]",
        `Config key to set/get. Prints the current value if no value is supplied. Valid keys: ${validKeys.join(",")}`,
    )
    .argument("[value]", "The value to set `key` to.")
    .action(action);
