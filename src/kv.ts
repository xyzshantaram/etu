import { join } from "https://deno.land/std@0.204.0/path/join.ts";
import dir from "https://deno.land/x/dir@1.5.2/mod.ts";

const dataDir = dir('data');
if (!dataDir) throw new Error("Couldn't find your data directory! Bailing.");

const dataPath = join(dataDir, 'etu');
await Deno.mkdir(dataPath, { recursive: true });
export const kv = await Deno.openKv(join(dataPath, 'etu.db'));