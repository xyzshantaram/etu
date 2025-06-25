// deno-lint-ignore-file no-explicit-any
import * as storage from "./storage.ts";
import { Result } from "@/oxide";
import { colors } from "@cliffy/ansi/colors";

export type Maybe<T> = T | undefined;

export interface Project {
    name: string;
    rate: number;
    slug: string;
    advance?: number;
}

export interface Session {
    name?: string;
    start: number;
    end?: number;
}

export type BareNote =
    & { name: string; description?: string }
    & (
        | { type: "kv" }
        | { type: "expense"; cost: number }
    );

export type Note = { id: string } & BareNote;

export const slugify = (str: string) => {
    return String(str)
        .normalize("NFKD") // split accented characters into their base characters and diacritical marks
        .replace(/[\u0300-\u036f]/g, "") // remove all the accents, which happen to be all in the \u03xx UNICODE block.
        .trim() // trim leading or trailing whitespace
        .toLowerCase() // convert to lowercase
        .replace(/[^a-z0-9 -]/g, "") // remove non-alphanumeric characters
        .replace(/\s+/g, "-") // replace spaces with hyphens
        .replace(/-+/g, "-"); // remove consecutive hyphens
};

export const getProjectId = async (
    id: Maybe<string>,
): Promise<Result<string, string>> => {
    if (!id) {
        const defaultId = await storage.getDefaultProject();
        return defaultId.okOr(
            "No project specified and no default project set.",
        );
    }

    const specified = await storage.getProjectById(id);
    return specified.map((v) => v.slug).okOr(
        "Specified project does not exist.",
    );
};

type TimeUnit = "y" | "mo" | "w" | "d" | "h" | "m" | "s" | "ms";

const msIn: Record<TimeUnit, number> = {
    ms: 1,
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
    w: 604_800_000,
    mo: 2_592_000_000,
    y: 31_536_000_000,
};

const prettyUnits: Record<TimeUnit, string> = {
    y: "year",
    mo: "month",
    w: "week",
    d: "day",
    h: "hour",
    m: "minute",
    s: "second",
    ms: "millisecond",
};

export const timeMs = (opts: Partial<Record<TimeUnit, number>>) =>
    (Object.keys(opts) as TimeUnit[])
        .map((u) => msIn[u] * (opts[u] || 0))
        .reduce((sum, i) => sum + i, 0);

export const descTime: TimeUnit[] = ["y", "mo", "w", "d", "h", "m", "s"];

export const msToTime = (ms: number): Partial<Record<TimeUnit, number>> => {
    const result: Partial<Record<TimeUnit, number>> = {};

    for (const unit of descTime) {
        if (ms >= msIn[unit]) {
            result[unit] = Math.floor(ms / msIn[unit]);
            ms %= msIn[unit];
        }
    }

    return result;
};

export const humanReadable = (ms: number, short = false) => {
    const times = msToTime(ms);
    const units = Object.keys(times);

    const keys = descTime.filter((k) => units.includes(k));
    const result: string[] = [];

    if (short) {
        return keys.map((key) => times[key]?.toString().padStart(2, "0") + key).join("");
    }

    keys.forEach((unit, i) => {
        if (unit in times) {
            result.push(
                `${times[unit]} ${prettyUnits[unit]}${times[unit] !== 1 ? "s" : ""}`,
            );
            let suffix = ", ";
            if (i == keys.length - 2) {
                suffix = " and ";
            } else if (i === keys.length - 1) {
                suffix = "";
            }
            result.push(suffix);
        }
    });

    return result.join("");
};

export const sessionName = (name: Maybe<string>, quoted = true) => {
    const s = name || "(untitled)";
    return quoted ? `\`${s}\`` : s;
};

export const die = (code: number, msg: string) => {
    if (code === 0) console.log(msg);
    else console.error(msg);
    return Deno.exit(code);
};

const error = colors.bold.red;
export const scream = (...args: any[]) => die(1, error(["ERROR:", ...args].join(" ")));
export const exit = (...args: any[]) => die(0, args.join(" "));

export const SELECTED_DATE_FUTURE_ERROR = "Date cannot be in the future";
export const SELECTED_DATE_END_BEFORE_START = "End date cannot be before start date";
export const SELECTED_DATE_START_AFTER_END = "Start date cannot be after end date";

export const success = colors.bold.green;
export const heading = colors.bold;
export const info = colors.bold.blue;
export const muted = colors.italic.gray;
