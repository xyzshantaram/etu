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
    static async *getSessions(id: string) {
        for await (const session of kv.list<Session>({ prefix: ['projects', id, 'sessions'] })) {
            yield session.value;
        }
    }
    static async getDefaultProject(): Promise<Option<string>> {
        const project = await kv.get<string>(['projects', 'default']);
        return Option(project.value);
    }

    static async getProjectById(id: string): Promise<Option<Project>> {
        const project = await kv.get<Project>(['projects', id]);
        if (project.value) return Some(project.value);
        return None;
    }

    static async putProject(project: Project) {
        await kv.set(['projects', project.slug], project);
    }

    static async putSession(id: string, sess: Session) {
        await kv.set(['projects', id, 'sessions', ulid()], sess);
    }

    static async getLastSession(id: string) {
        return await kv
            .list<Session>({ prefix: ['projects', id, 'sessions'] }, { limit: 1, reverse: true })
            .next()
            .then(itm => itm.value);
    }

    static async endSession(identifier: Deno.KvEntry<Session>, end: number): Promise<void>;
    static async endSession(identifier: string, end: number): Promise<void>;
    static async endSession(identifier: unknown, end: number) {
        if (typeof identifier === 'string') {
            await this.getLastSession(identifier)
                .then(async item => item && await kv.set(item.key, { ...item.value, end }));
        }
        else {
            const entry = identifier as Deno.KvEntry<Session>;
            await kv.set(entry.key, { ...entry.value, end });
        }

    }

    static async setDefaultProject(id: string): Promise<Result<null, string>> {
        const project = await EtuStorage.getProjectById(id);
        if (project.isNone()) return Err(`Project ${id} does not exist.`);
        await kv.set(['projects', 'default'], id);

        return Ok(null);
    }

    static async getCurrency() {
        const currency = await kv.get<string>(['config', 'currency']);
        return currency.value || "$";
    }

    static async setCurrency(symbol: string) {
        await kv.set(['config', 'currency'], symbol);
    }
}