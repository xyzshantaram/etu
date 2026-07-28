import { Command } from "commander";
import { match } from "@/oxide";
import {
    descTime,
    fail,
    getProjectId,
    heading,
    humanReadable,
    respond,
    SELECTED_DATE_END_BEFORE_START,
    SELECTED_DATE_FUTURE_ERROR,
    SELECTED_DATE_START_AFTER_END,
    sessionName,
    success,
    timeMs,
} from "@/utils.ts";
import { getSessionChoices } from "./mod.ts";
import { Input, Select } from "@cliffy/prompt";
import { Table } from "@cliffy/table";
import * as storage from "@/storage.ts";

interface EEditSessionOpts {
    project: string;
    sessionId?: string;
    start?: string;
    end?: string;
    removeEnd?: boolean;
    rename?: string;
}

const TIME_DELTA_REGEX = new RegExp("(now)?([+-])(\\d+)(" + descTime.join("|") + ")");

/** Parse a time flag value into Unix milliseconds. */
function parseTimeFlag(value: string): number | Error {
    const trimmed = value.trim();
    if (trimmed === "now") return Date.now();

    const matches = trimmed.match(TIME_DELTA_REGEX);
    if (matches) {
        const [, , direction, duration, unit] = matches;
        const sign = direction === "+" ? 1 : -1;
        const n = parseInt(duration);
        return Date.now() + sign * timeMs({ [unit]: n });
    }

    // Try as Unix ms number
    const asNum = Number(trimmed);
    if (!isNaN(asNum)) return asNum;

    // Try as date string
    const d = new Date(trimmed);
    if (!isNaN(d.valueOf())) return d.valueOf();

    return new Error(`Invalid time value: "${value}". Expected "now", Unix ms, delta like "+1h", or date string.`);
}

const action = async ({ project, sessionId, start, end, removeEnd, rename }: EEditSessionOpts, cmd: Command) => {
    const isStructured = (cmd.optsWithGlobals() as Record<string, unknown>).structured;

    return await match(await getProjectId(project), {
        Err: (msg: string) => fail(cmd, msg),
        Ok: async (id: string) => {
            const { choices, map } = await getSessionChoices(id);

            let toEdit: string;
            if (sessionId) {
                // Look up the session by ULID directly from the map
                const entry = map[sessionId];
                if (!entry) fail(cmd, `Session ${sessionId} does not exist in project ${id}.`);
                toEdit = entry.ulid;
            } else if (isStructured) {
                fail(cmd, "--session-id <ulid> is required in structured mode.");
            } else {
                toEdit = await Select.prompt({
                    transform: (v) => map[v].ulid,
                    message: "Which session do you want to edit?",
                    options: choices,
                });
            }

            let changed = { ...map[toEdit].obj };

            // If any edit flag is provided, apply changes directly (no interactive loop)
            const hasFlags = start !== undefined || end !== undefined || removeEnd || rename !== undefined;

            if (isStructured && !hasFlags) {
                fail(cmd, "--start, --end, --remove-end, and/or --rename is required in structured mode.");
            }

            if (hasFlags) {
                if (start !== undefined) {
                    const parsed = parseTimeFlag(start);
                    if (parsed instanceof Error) fail(cmd, parsed.message);
                    if (parsed > Date.now()) fail(cmd, SELECTED_DATE_FUTURE_ERROR);
                    if (changed.end && parsed > changed.end) fail(cmd, SELECTED_DATE_START_AFTER_END);
                    changed = { ...changed, start: parsed };
                }
                if (end !== undefined) {
                    const parsed = parseTimeFlag(end);
                    if (parsed instanceof Error) fail(cmd, parsed.message);
                    if (parsed > Date.now()) fail(cmd, SELECTED_DATE_FUTURE_ERROR);
                    if (parsed < changed.start) fail(cmd, SELECTED_DATE_END_BEFORE_START);
                    changed = { ...changed, end: parsed };
                }
                if (removeEnd) {
                    changed = { ...changed, end: undefined };
                }
                if (rename !== undefined) {
                    changed = { ...changed, name: rename };
                }

                await storage.editSession(id, toEdit, changed);
                await storage.touchProject(id);
                respond(cmd, (data) => {
                    console.log(data.message);
                }, {
                    message: "Session updated.",
                    session: changed,
                });
                return;
            }

            // Interactive loop (existing behaviour)
            let inp = "";
            while (inp != "exit") {
                console.log("Current values:");
                new Table(...Object.entries({
                    name: heading(sessionName(changed.name, false)),
                    start: new Date(changed.start).toLocaleString(),
                    end: changed.end ? new Date(changed.end).toLocaleString() : "(ongoing session; no end time)",
                    duration: success(humanReadable((changed.end || Date.now()) - changed.start)),
                }))
                    .border(true)
                    .render();

                inp = await Select.prompt({
                    message: "What would you like to do?",
                    options: ["change start time", "change end time", "remove end time", "rename", "exit"],
                });

                const acceptTime = async (selecting: "start" | "end", start: number, end?: number) => {
                    const TIME_DELTA_REGEX = new RegExp("(now)?([+-])(\\d+)(" + descTime.join("|") + ")");
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
                                const [, relativeToNow, direction, duration, unit] = matches;
                                const sign = direction === "+" ? 1 : -1;
                                const n = parseInt(duration);
                                const ms = (relativeToNow ? now : (selecting === "start" ? start : (end || now))) +
                                    sign * timeMs({ [unit]: n });

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
                        const startVal = await acceptTime("start", changed.start, changed.end);
                        changed = { ...changed, start: startVal };
                        console.log("Changed successfully.");
                        break;
                    }
                    case "change end time": {
                        const endVal = await acceptTime("end", changed.start, changed.end);
                        changed = { ...changed, end: endVal };
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
                await storage.touchProject(id);
                respond(cmd, (data) => {
                    console.log(data.message);
                }, {
                    message: "Session updated.",
                    session: changed,
                });
            }
        },
    });
};

export const edit = new Command("edit")
    .option("-p --project <string>", "id of the project whose session to edit. uses default project if not specified.")
    .description("Edit a session of a project.")
    .option("--session-id <ulid>", "ULID of the session to edit. Skips interactive selection.")
    .option("--start <value>", "New start time (Unix ms, 'now', or delta like '+1h').")
    .option("--end <value>", "New end time (Unix ms, 'now', or delta like '+1h').")
    .option("--remove-end", "Remove the end time (make session ongoing).")
    .option("--rename <name>", "New name for the session.")
    .action(action);
