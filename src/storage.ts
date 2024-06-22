import { join } from "https://deno.land/std@0.204.0/path/join.ts";
import dir from "https://deno.land/x/dir@1.5.2/mod.ts";
import { Project, Session } from "./utils.ts";
import { None, Option, Result } from "@/oxide";
import { Some } from "@/oxide";
import { ulid } from "@/ulid";
import { Err } from "@/oxide";
import { Ok } from "@/oxide";

const dataDir = dir('data');
if (!dataDir) throw new Error("Couldn't find your data directory! Bailing.");

const dataPath = join(dataDir, 'etu');
await Deno.mkdir(dataPath, { recursive: true });
const kv = await Deno.openKv(join(dataPath, 'etu.db'));

export class EtuStorage {
    static async getDefaultProject(): Promise<Option<string>> {
        const project = await kv.get<string>(['projects', 'default']);
        return Option(project.value);
    }

    static async getProjectById(id: string): Promise<Option<string>> {
        const project = await kv.get<Project>(['projects', id]);
        if (project.value) return Some(id);
        return None;
    }

    static async setProject(project: Project) {
        await kv.set(['projects', project.slug], project);
    }

    static async putSession(id: string, sess: Session) {
        await kv.set(['projects', id, 'sessions', ulid()], { end: -1, ...sess });
    }

    static async endSession(id: string, end: number) {
        return await kv
            .list<Session>({ prefix: ['projects', id, 'sessions'] }, { limit: 1, reverse: true })
            .next()
            .then(itm => itm.value)
            .then(async item => item && await kv.set(item.key, { ...item.value, end }));
    }

    static async setDefaultProject(id: string): Promise<Result<null, string>> {
        const project = await EtuStorage.getProjectById(id);
        if (project.isNone()) return Err(`Project ${id} does not exist.`);
        await kv.set(['projects', 'default'], id);

        return Ok(null);
    }
}