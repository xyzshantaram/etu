import { Command } from "commander";
import { info, Maybe, scream, success } from "../../utils.ts";
import * as storage from "../../storage.ts";

const defaults = {
    "currency": "$",
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

const action = async (key: Maybe<string>, value: Maybe<string>) => {
    if (key && !isValidKey(key)) {
        scream(`${key} is not a valid configuration key.`);
    }

    if (key && value) {
        await storage.setConfigValue(key, value);
        return console.log(success(`Successfully set ${key} to ${value}`));
    } else if (key && !value) {
        const item = await storage.getConfigValue(key);
        return console.log(`${key}: ${info(item)}`);
    }
    for (const k of validKeys) {
        const v = await storage.getConfigValue(k);
        console.log(`${k}: ${info(v === "" ? "<nothing>" : v)}`);
    }
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
