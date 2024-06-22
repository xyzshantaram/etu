// deno-lint-ignore-file no-explicit-any
import * as storage from "./storage.ts";
import { Result } from "@/oxide";

export type Maybe<T> = T | undefined;

export interface Project {
    name: string;
    rate: number;
    slug: string;
}

export interface Session {
    name?: string;
    start: number;
    end?: number;
}

export const slugify = (str: string) => {
    return String(str)
        .normalize('NFKD') // split accented characters into their base characters and diacritical marks
        .replace(/[\u0300-\u036f]/g, '') // remove all the accents, which happen to be all in the \u03xx UNICODE block.
        .trim() // trim leading or trailing whitespace
        .toLowerCase() // convert to lowercase
        .replace(/[^a-z0-9 -]/g, '') // remove non-alphanumeric characters
        .replace(/\s+/g, '-') // replace spaces with hyphens
        .replace(/-+/g, '-'); // remove consecutive hyphens
}

/**
 * Retrieves the project ID based on the provided ID or the default project ID if no ID is specified.
 *
 * @param {Maybe<string>} id The ID of the project to retrieve. If not provided, the default project ID will be used.
 * @returns {Promise<Result<string, string>>} A promise that resolves to a `Result` object containing the project ID if successful, or an error message if not.
 *
 * @example
 * ```ts
 * const projectId = await getProjectId("project-123");
 * if (projectId.isOk()) {
 *   console.log("Project ID:", projectId.unwrap());
 * } else {
 *   console.error("Error:", projectId.unwrapErr());
 * }
 * ```
 */
export const getProjectId = async (id: Maybe<string>): Promise<Result<string, string>> => {
    if (!id) {
        const defaultId = await storage.getDefaultProject();
        return defaultId.okOr("No project specified and no default project set.");
    }

    const specified = await storage.getProjectById(id);
    return specified.map(v => v.slug).okOr("Specified project does not exist.");
}

type TimeUnit = 'y' | 'mo' | 'w' | 'd' | 'h' | 'm' | 's' | 'ms';

const msIn: Record<TimeUnit, number> = {
    ms: 1,
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
    w: 604_800_000,
    mo: 2_592_000_000,
    y: 31_536_000_000,
}

const prettyUnits: Record<TimeUnit, string> = {
    y: "year",
    mo: "month",
    w: "week",
    d: "day",
    h: "hour",
    m: "minute",
    s: "second",
    ms: "millisecond"
}

export const timeMs = (opts: Partial<Record<TimeUnit, number>>) =>
    (Object.keys(opts) as TimeUnit[])
        .map((u) => msIn[u] * (opts[u] || 0))
        .reduce((sum, i) => sum + i, 0);

const descTime: TimeUnit[] = ['y', 'mo', 'w', 'd', 'h', 'm', 's'];

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

export const humanReadable = (ms: number) => {
    const times = msToTime(ms);
    const units = Object.keys(times);

    const keys = descTime.filter(k => units.includes(k));
    const result: string[] = [];

    keys.forEach((unit, i) => {
        if (unit in times) {
            result.push(`${times[unit]} ${prettyUnits[unit]}${times[unit] !== 1 ? 's' : ''}`);
            let suffix = ', ';
            if (i == keys.length - 2) {
                suffix = ' and ';
            }
            else if (i === keys.length - 1) {
                suffix = ''
            }
            result.push(suffix);
        }
    })

    return result.join('');
}

export const sessionName = (name: Maybe<string>) => name || "(untitled)";

export const die = (code: number, ...args: any[]) => {
    console.log(...args);
    return Deno.exit(code);
}

export const scream = (...args: any[]) => die(1, args);
export const exit = (...args: any[]) => die(0, args);