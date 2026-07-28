/**
 * Test helpers for etu CLI regression suite.
 * Provides isolated subprocess execution with temp XDG_DATA_HOME.
 *
 * ## Why we forward DENO_DIR
 *
 * Each test gives the CLI child a fresh temporary `HOME`/`XDG_DATA_HOME` so
 * etu's KV store, config, and document-dir resolution stay isolated.  Without
 * intervention, a fresh HOME also means Deno starts with an empty dependency
 * cache, which causes every `deno run` child to re-resolve (and often
 * re-download) every dependency — adding ~6 s per test subprocess.
 *
 * By resolving the *parent* Deno cache directory once and injecting it as
 * `DENO_DIR` into each child, the children reuse the already-populated cache,
 * eliminating that overhead while keeping `HOME`/`XDG_DATA_HOME` isolated.
 */

// ── Cache-directory resolution (once, at module-import time) ──────────────

/**
 * Resolves the Deno cache directory to forward to child processes.
 * First checks the `DENO_DIR` env var; if absent, queries the Deno binary.
 * Produces a clear error if neither method succeeds.
 */
function resolveDenoDir(): string {
    // 1. Explicit override from the environment (highest priority).
    const envDir = Deno.env.get("DENO_DIR");
    if (envDir) return envDir;

    // 2. Query the current Deno binary for its built-in canonical location.
    try {
        const cmd = new Deno.Command(Deno.execPath(), {
            args: ["info", "--json"],
            stdout: "piped",
            stderr: "piped",
        });
        const { code, stdout } = cmd.outputSync();
        if (code !== 0) {
            throw new Error(`deno info --json exited with code ${code}`);
        }
        const info = JSON.parse(new TextDecoder().decode(stdout));
        if (typeof info.denoDir !== "string" || info.denoDir.length === 0) {
            throw new Error("deno info --json did not include a valid denoDir field");
        }
        return info.denoDir as string;
    } catch (e) {
        throw new Error(
            "Failed to resolve Deno cache directory: " +
                String(e) +
                "\n\nSet the DENO_DIR environment variable and re-run, or ensure deno info --json works.",
        );
    }
}

/** Deno cache directory forwarded to every test child process. */
const DENO_DIR = resolveDenoDir();

// ── Public helpers ────────────────────────────────────────────────────────

interface RawResult {
    code: number;
    stdout: string;
    stderr: string;
}

interface StructuredResult extends RawResult {
    parsed: { ok: boolean; data?: unknown; error?: string } | null;
}

/** Root of the etu repository, computed relative to this file. */
const REPO_ROOT = new URL("..", import.meta.url).pathname;

/**
 * Run the source CLI (src/etu.ts) as a subprocess with an isolated data directory.
 * `XDG_DATA_HOME` and `HOME` are set to `dataDir` so the KV store and document-dir
 * resolution stay inside the temp tree.  `DENO_DIR` is forwarded from the parent
 * so the child reuses the existing dependency cache (see the module-level docstring
 * above for the rationale).
 */
export async function runEtu(args: string[], dataDir: string): Promise<RawResult> {
    const cmd = new Deno.Command(Deno.execPath(), {
        cwd: REPO_ROOT,
        env: {
            HOME: dataDir,
            XDG_DATA_HOME: dataDir,
            DENO_DIR,
        },
        args: [
            "run",
            "--unstable-kv",
            "--allow-env",
            "--allow-read",
            "--allow-write",
            "--allow-ffi",
            "src/etu.ts",
            ...args,
        ],
        stdout: "piped",
        stderr: "piped",
    });
    const { code, stdout, stderr } = await cmd.output();
    return {
        code,
        stdout: new TextDecoder().decode(stdout),
        stderr: new TextDecoder().decode(stderr),
    };
}

/**
 * Like `runEtu` but prepends `--structured` and attempts to parse stdout as
 * the structured response envelope `{ ok, data? | error? }`.
 * On parse failure, throws with raw stdout included.
 */
export async function runStructured(
    args: string[],
    dataDir: string,
): Promise<StructuredResult> {
    const raw = await runEtu(["--structured", ...args], dataDir);
    let parsed: StructuredResult["parsed"] = null;
    try {
        parsed = JSON.parse(raw.stdout.trim());
    } catch (e) {
        throw new Error(
            `Failed to parse structured JSON from stdout.\nRaw stdout:\n---\n${raw.stdout}\n---\nParse error: ${
                String(e)
            }`,
        );
    }
    return { ...raw, parsed };
}

/**
 * Run a function with a temporary isolated data directory.
 * The directory is guaranteed to be recursively removed afterward.
 */
export async function withTempDataDir(
    fn: (dataDir: string) => Promise<void>,
): Promise<void> {
    const dir = await Deno.makeTempDir({ prefix: "etu-test-" });
    try {
        await fn(dir);
    } finally {
        await Deno.remove(dir, { recursive: true });
    }
}
