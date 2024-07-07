import { Command } from "@/commander";
import { match } from "@/oxide";
import { SELECTED_DATE_END_BEFORE_START, SELECTED_DATE_FUTURE_ERROR, SELECTED_DATE_START_AFTER_END, descTime, getProjectId, scream, timeMs } from "../../utils.ts";
import { getSessionChoices } from "./mod.ts";
import { Input, Select } from "@/cliffy/prompt";
import * as storage from "../../storage.ts";

interface EEditSessionOpts {
    project: string;
}

const action = async ({ project }: EEditSessionOpts) => {
    return await match(await getProjectId(project), {
        Err: (msg: string) => scream(msg),
        Ok: async (id: string) => {
            const { choices, map } = await getSessionChoices(id);
            const toEdit = await Select.prompt({
                transform: (v) => map[v].ulid,
                message: "Which session do you want to edit?",
                options: choices,
            });

            console.log("Current values:");
            console.log(map[toEdit].obj);

            let changed = { ...map[toEdit].obj };

            let inp = "";
            while (inp != "exit") {
                inp = await Select.prompt({
                    message: "What would you like to do?",
                    options: ["change start time", "change end time", "remove end time", "rename", "exit"],
                });

                const log = (s: string) => Deno.writeTextFileSync('./tmp.txt', '\n' + s, { create: true, append: true })

                const acceptTime = async (selecting: "start" | "end", start: number, end?: number) => {
                    const TIME_DELTA_REGEX = new RegExp("(now)?([+-])(\\d+)(" + descTime.join("|") + ")");
                    log(TIME_DELTA_REGEX.toString());
                    let finalDate;
                    await Input.prompt({
                        message: "What should I set the time to? (yyyy-mm-dd hh:mm:ss | delta | now)",
                        validate: (input) => {
                            const now = Date.now();
                            const trimmed = input.trim();
                            if (trimmed === "now") {
                                finalDate = new Date(now);
                                return true;
                            }
                            const matches = trimmed.match(TIME_DELTA_REGEX);
                            if (matches) {
                                log(JSON.stringify(matches));
                                const [, relativeToNow, direction, duration, unit] = matches;
                                const sign = direction === "+" ? 1 : -1;
                                const n = parseInt(duration);
                                const ms = (relativeToNow ? now : (selecting === "start" ? start : (end || now))) +
                                    sign * timeMs({ [unit]: n });
                                log(JSON.stringify({
                                    ms, sign, direction, n, duration, unit, relativeToNow
                                }))

                                if (ms > now) return SELECTED_DATE_FUTURE_ERROR;

                                if (selecting === "start" && (end && ms > end)) {
                                    return SELECTED_DATE_START_AFTER_END;
                                }
                                if (selecting === "end" && ms < start) {
                                    return SELECTED_DATE_END_BEFORE_START;
                                }

                                finalDate = new Date(ms);
                                return true;
                            }

                            const d = new Date(trimmed);
                            if (isNaN(d.valueOf())) return false;

                            if (d.valueOf() > Date.now()) return SELECTED_DATE_FUTURE_ERROR;

                            if (selecting === "start") {
                                if (end && d.valueOf() > end) return SELECTED_DATE_START_AFTER_END;
                                finalDate = d;
                                return true;
                            }
                            if (selecting === "end") {
                                if (d.valueOf() < start) return SELECTED_DATE_END_BEFORE_START;
                                finalDate = d;
                                return true;
                            }

                            return false;
                        },
                    });
                    return finalDate!.valueOf();
                };

                switch (inp) {
                    case "change start time": {
                        const start = await acceptTime("start", changed.start, changed.end);
                        changed = { ...changed, start };
                        console.log("Changed successfully.");
                        break;
                    }
                    case "change end time": {
                        const end = await acceptTime("end", changed.start, changed.end);
                        changed = { ...changed, end };
                        console.log("Changed successfully.");
                        break;
                    }
                    case "rename": {
                        const name = await Input.prompt("What should the new name be?");
                        changed = { ...changed, name };
                        console.log("Changed successfully.");
                        break;
                    }
                    case "remove end time":
                        changed = { ...changed, end: undefined };
                        console.log("Removed successfully.");
                        break;
                    default:
                        break;
                }

                await storage.editSession(id, toEdit, changed);
            }
        },
    });
};

export const edit = new Command("edit")
    .option("-p --project", "id of the project to edit. uses default project if not specified.")
    .description("Edit a session of a project.")
    .action(action);
