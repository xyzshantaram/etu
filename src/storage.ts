import { join } from "https://deno.land/std@0.204.0/path/join.ts";
import dir from "https://deno.land/x/dir@1.5.2/mod.ts";
import { Project, scream, Session } from "./utils.ts";
import { Err, None, Ok, Option, Result, Some } from "@/oxide";
import { ulid } from "@/ulid";

const dataDir = dir("data");
if (!dataDir) scream("Couldn't find your data directory! Bailing.");

const dataPath = join(dataDir!, "etu");
await Deno.mkdir(dataPath, { recursive: true });
const kv = await Deno.openKv(join(dataPath, "etu.db"));

export async function* getSessions(id: string) {
    for await (
        const session of kv.list<Session>({
            prefix: ["projects", id, "sessions"],
        })
    ) {
        yield session.value;
    }
}

export async function* getProjects() {
    for await (const project of kv.list<Project>({ prefix: ["projects"] })) {
        if (project.key.length === 2) yield project.value;
    }
}

export async function getDefaultProject(): Promise<Option<string>> {
    const project = await kv.get<string>(["config", "default-project"]);
    return Option(project.value);
}

export async function getProjectById(id: string): Promise<Option<Project>> {
    const project = await kv.get<Project>(["projects", id]);
    if (project.value) return Some(project.value);
    return None;
}

export async function putProject(project: Project) {
    await kv.set(["projects", project.slug], project);
}

export async function putSession(id: string, sess: Session) {
    await kv.set(["projects", id, "sessions", ulid()], sess);
}

export async function getLastSession(id: string) {
    return await kv
        .list<Session>({ prefix: ["projects", id, "sessions"] }, {
            limit: 1,
            reverse: true,
        })
        .next()
        .then((itm) => itm.value);
}

export async function endSession(
    identifier: Deno.KvEntry<Session>,
    end: number,
): Promise<void>;
export async function endSession(
    identifier: string,
    end: number,
): Promise<void>;
export async function endSession(identifier: unknown, end: number) {
    if (typeof identifier === "string") {
        await getLastSession(identifier)
            .then(async (item) => item && await kv.set(item.key, { ...item.value, end }));
    } else {
        const entry = identifier as Deno.KvEntry<Session>;
        await kv.set(entry.key, { ...entry.value, end });
    }
}

export async function setDefaultProject(
    id: string,
): Promise<Result<null, string>> {
    const project = await getProjectById(id);
    if (project.isNone()) return Err(`Project ${id} does not exist.`);
    await kv.set(["config", "default-project"], id);

    return Ok(null);
}

export async function getConfigValue(key: string) {
    // deno-lint-ignore no-explicit-any
    const entry = await kv.get<any>(["config", key]);
    return entry.value;
}

export async function setConfigValue(key: string, value: string) {
    await kv.set(["config", key], value);
}

export async function deleteProject(id: string) {
    const keys: Deno.KvKey[] = [];
    for await (const item of kv.list({ prefix: ["projects", id] })) {
        keys.push(item.key);
    }
    if (await getDefaultProject().then((v) => v.unwrapOr(""))) {
        keys.push(["config", "default-project"]);
    }

    await Promise.all(keys.map((key) => kv.delete(key)));
}
