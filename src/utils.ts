import { EtuStorage } from "./storage.ts";
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
        const defaultId = await EtuStorage.getDefaultProject();
        return defaultId.okOr("No project specified and no default project set.");
    }

    const specified = await EtuStorage.getProjectById(id);
    return specified.okOr("Specified project does not exist.");
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

export const timeMs = (opts: Partial<Record<TimeUnit, number>>) =>
    (Object.keys(opts) as TimeUnit[])
        .map((u) => msIn[u] * (opts[u] || 0))
        .reduce((sum, i) => sum + i, 0);