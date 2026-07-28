import * as path from "@std/path";
import { BareMemo, dataPath, Memo, Project, Session } from "./utils.ts";
import { Err, None, Ok, Option, Result, Some } from "@/oxide";
import { ulid } from "@std/ulid";

let kv: Deno.Kv;

const getKv = async () => {
    if (!kv) {
        kv = await Deno.openKv(path.join(dataPath, "etu.db"));
    }
    return kv;
};

export async function* getSessions(id: string) {
    const kv = await getKv();
    for await (
        const session of kv.list<Session>({
            prefix: ["projects", id, "sessions"],
        })
    ) {
        yield session;
    }
}

export async function* getProjects() {
    const kv = await getKv();
    for await (const project of kv.list<Project>({ prefix: ["projects"] })) {
        if (project.key.length === 2) yield await backfillTimestamps(project.value);
    }
}

async function backfillTimestamps(project: Project): Promise<Project> {
    const hasCreatedAt = project.createdAt !== undefined;
    const hasLastModified = project.lastModified !== undefined;

    if (hasCreatedAt && hasLastModified) return project;

    const migrated = { ...project };
    let earliestStart: number | undefined;
    let latestActivity: number | undefined;

    for await (const session of getSessions(project.slug)) {
        const start = session.value.start;
        const end = session.value.end ?? start;

        if (earliestStart === undefined || start < earliestStart) {
            earliestStart = start;
        }
        if (latestActivity === undefined || end > latestActivity) {
            latestActivity = end;
        }
    }

    if (!hasCreatedAt) {
        migrated.createdAt = earliestStart ?? Date.now();
    }
    if (!hasLastModified) {
        migrated.lastModified = latestActivity ?? migrated.createdAt!;
    }

    await putProject(migrated);
    return migrated;
}

export async function touchProject(slug: string): Promise<void> {
    const project = await getProjectById(slug);
    if (project.isNone()) return;
    const p = project.unwrap();
    await putProject({ ...p, lastModified: Date.now() });
}

export async function getDefaultProject(): Promise<Option<string>> {
    const kv = await getKv();
    const project = await kv.get<string>(["config", "default-project"]);
    return Option(project.value);
}

export async function getProjectById(id: string): Promise<Option<Project>> {
    const kv = await getKv();
    const project = await kv.get<Project>(["projects", id]);
    if (project.value) return Some(project.value);
    return None;
}

export async function putProject(project: Project) {
    const kv = await getKv();
    await kv.set(["projects", project.slug], project);
}

export async function putSession(id: string, sess: Session): Promise<string> {
    const kv = await getKv();
    const sessionId = ulid();
    await kv.set(["projects", id, "sessions", sessionId], sess);
    return sessionId;
}

export async function getLastSession(id: string) {
    const kv = await getKv();
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
    const kv = await getKv();
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
    const kv = await getKv();
    const project = await getProjectById(id);
    if (project.isNone()) return Err(`Project ${id} does not exist.`);
    await kv.set(["config", "default-project"], id);

    return Ok(null);
}

export async function getConfigValue(key: string) {
    const kv = await getKv();
    // deno-lint-ignore no-explicit-any
    const entry = await kv.get<any>(["config", key]);
    return entry.value;
}

export async function setConfigValue(key: string, value: string) {
    const kv = await getKv();
    await kv.set(["config", key], value);
}

export async function deleteProject(id: string, silent = false) {
    const kv = await getKv();
    const keys: Deno.KvKey[] = [];
    for await (const item of kv.list({ prefix: ["projects"] })) {
        if (item.key[1] === id) keys.push(item.key);
    }

    if (await getDefaultProject().then((v) => v.unwrapOr("") === id)) {
        keys.push(["config", "default-project"]);
    }

    if (keys.length === 0) {
        if (!silent) console.log(`No items associated with project ${id} found. Are you sure you got the name right?`);
        return;
    }

    await Promise.all(keys.map((key) => kv.delete(key)));
    if (!silent) console.log("Deleted successfully.");
}

export const deleteSession = async (id: string, toDelete: string) => {
    const kv = await getKv();
    await kv.delete(["projects", id, "sessions", toDelete]);
};

export const editSession = async (proj: string, ulid: string, body: Session) => {
    const kv = await getKv();
    await kv.set(["projects", proj, "sessions", ulid], body);
};

export const getProjectNotes = async (proj: string) => {
    const kv = await getKv();
    const notes: Memo[] = [];
    for await (const note of kv.list<Memo>({ prefix: ["projects", proj, "notes"] })) {
        notes.push(note.value);
    }
    return notes;
};

export const deleteNote = async (proj: string, id: string) => {
    const kv = await getKv();
    await kv.delete(["projects", proj, "notes", id]);
};

export const createNote = async (proj: string, note: BareMemo) => {
    const kv = await getKv();
    const id = ulid();
    const itm: Memo = { ...note, id };
    await kv.set(["projects", proj, "notes", id], itm);
    return itm;
};
