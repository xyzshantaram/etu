/**
 * Regression tests for etu's --structured output mode.
 * Covers: global structured output, config, project edit clobbering,
 * memo flags, delete safety, required target IDs,
 * structured edit guards, structured status --short, and project-list enrichment.
 */
import { runEtu, runStructured, withTempDataDir } from "../test_helpers.ts";
import { assert, assertEquals, assertMatch } from "jsr:@std/assert@1";
import * as path from "@std/path";
import { type Project, type Session } from "@/utils.ts";
import { ulid } from "@std/ulid";

// ---------------------------------------------------------------------------
// 1. Global structured output + positional signature
// ---------------------------------------------------------------------------

Deno.test("--structured config (no args) succeeds with currency and output-path fields", async () => {
    await withTempDataDir(async (dir) => {
        const { code, parsed } = await runStructured(["config"], dir);
        assertEquals(code, 0);
        assert(parsed!.ok, "expected ok:true");
        const data = parsed!.data as Record<string, unknown>;
        assert(typeof data.currency === "string", "currency should be a string");
        assert(typeof data["output-path"] === "string", "output-path should be a string");
    });
});

Deno.test("--structured config currency '€' sets config and returns key/value", async () => {
    await withTempDataDir(async (dir) => {
        const { code, parsed } = await runStructured(["config", "currency", "€"], dir);
        assertEquals(code, 0);
        assert(parsed!.ok, "expected ok:true");
        const data = parsed!.data as Record<string, unknown>;
        assertEquals(data.key, "currency", "should contain key:currency");
        assertEquals(data.value, "€", "should contain value:€");
    });
});

Deno.test("--json config exits nonzero with 'unknown option'", async () => {
    await withTempDataDir(async (dir) => {
        const { code, stdout, stderr } = await runEtu(["--json", "config"], dir);
        assert(code !== 0, "expected non-zero exit code");
        const combined = stdout + stderr;
        assert(combined.length > 0, "expected error output for --json");
    });
});

// ---------------------------------------------------------------------------
// 2. Project edit clobbering regression
// ---------------------------------------------------------------------------

Deno.test("project edit with flags preserves all values (no clobbering)", async () => {
    await withTempDataDir(async (dir) => {
        // Create project
        const newResult = await runStructured(["project", "new", "Acme", "25", "--project", "acme"], dir);
        assertEquals(newResult.code, 0);

        // Edit with all three flags in one shot
        const editResult = await runStructured([
            "project",
            "edit",
            "--project",
            "acme",
            "--rate",
            "50",
            "--advance",
            "2",
            "--rename",
            "Acme Updated",
        ], dir);
        assertEquals(editResult.code, 0);

        // List projects and verify
        const listResult = await runStructured(["project", "list"], dir);
        assertEquals(listResult.code, 0);
        assert(listResult.parsed !== null);
        assert(listResult.parsed!.ok);

        const data = listResult.parsed!.data as {
            projects: Array<{ name: string; slug: string; rate: number; advance: number }>;
        };
        const acme = data.projects.find((p) => p.slug === "acme");
        assert(acme !== undefined, "project 'acme' should exist in list");
        assertEquals(acme.name, "Acme Updated", "rename should be preserved");
        assertEquals(acme.rate, 50, "rate should be preserved");
        assertEquals(acme.advance, 2, "advance should be preserved");
    });
});

// ---------------------------------------------------------------------------
// 3. Non-interactive memo flags
// ---------------------------------------------------------------------------

Deno.test("memo add with --description and --cost succeeds without prompting", async () => {
    await withTempDataDir(async (dir) => {
        // Create a project first
        const newResult = await runStructured(["project", "new", "Acme", "25", "--project", "acme"], dir);
        assertEquals(newResult.code, 0);

        const { code, parsed } = await runStructured([
            "memo",
            "add",
            "Travel",
            "--project",
            "acme",
            "--description",
            "Train",
            "--cost",
            "12.5",
        ], dir);
        assertEquals(code, 0, `expected exit 0, got ${code}`);
        assert(parsed !== null, "expected valid JSON stdout");
        assert(parsed!.ok, "expected ok:true");

        const data = parsed!.data as { memo: { name: string; type: string; project: string } };
        assertEquals(data.memo.name, "Travel");
        assertEquals(data.memo.type, "expense");
        assertEquals(data.memo.project, "acme");
    });
});

// ---------------------------------------------------------------------------
// 4. Delete safety contract
// ---------------------------------------------------------------------------

Deno.test("project delete without --yes in structured mode fails with guidance", async () => {
    await withTempDataDir(async (dir) => {
        await runStructured(["project", "new", "Acme", "25", "--project", "acme"], dir);

        const { code, parsed } = await runStructured(["project", "delete", "--project", "acme"], dir);
        assert(code !== 0, "expected non-zero exit code");
        assert(parsed !== null, "expected valid JSON error");
        assertEquals(parsed!.ok, false);
        assertEquals(parsed!.error, "--yes is required in structured mode for deletion.");
    });
});

Deno.test("project delete with --yes succeeds", async () => {
    await withTempDataDir(async (dir) => {
        await runStructured(["project", "new", "Acme", "25", "--project", "acme"], dir);

        const result = await runStructured(["project", "delete", "--project", "acme", "--yes"], dir);

        assertEquals(result.code, 0, "expected exit 0");
        assert(result.parsed!.ok, "expected ok:true");
        assertEquals((result.parsed!.data as Record<string, unknown>).deletedProject, "acme");
    });
});

// ---------------------------------------------------------------------------
// 5. Required target IDs in structured mode
// ---------------------------------------------------------------------------

Deno.test("session delete without --session-id in structured mode fails with guidance", async () => {
    await withTempDataDir(async (dir) => {
        // Need a default project for the command to reach the session-id check
        await runStructured(["project", "new", "Acme", "25", "--project", "acme"], dir);

        const { code, parsed } = await runStructured(["session", "delete", "--project", "acme"], dir);
        assert(code !== 0, "expected non-zero exit code");
        assert(parsed !== null, "expected valid JSON error");
        assertEquals(parsed!.ok, false);
        assertMatch(parsed!.error!, /--session-id.*is required in structured mode/);
    });
});

Deno.test("memo delete without --memo-id in structured mode fails with guidance", async () => {
    await withTempDataDir(async (dir) => {
        await runStructured(["project", "new", "Acme", "25", "--project", "acme"], dir);

        const { code, parsed } = await runStructured(["memo", "delete", "--project", "acme"], dir);
        assert(code !== 0, "expected non-zero exit code");
        assert(parsed !== null, "expected valid JSON error");
        assertEquals(parsed!.ok, false);
        assertMatch(parsed!.error!, /--memo-id.*is required in structured mode/);
    });
});

// ---------------------------------------------------------------------------
// 6. Structured edit guards: must provide at least one mutation flag
// ---------------------------------------------------------------------------

Deno.test("structured project edit without mutation flags fails with guidance", async () => {
    await withTempDataDir(async (dir) => {
        await runStructured(["project", "new", "Acme", "25", "--project", "acme"], dir);

        const { code, parsed } = await runStructured(["project", "edit", "--project", "acme"], dir);
        assert(code !== 0, "expected non-zero exit code");
        assert(parsed !== null, "expected valid JSON error");
        assertEquals(parsed!.ok, false);
        assertMatch(parsed!.error!, /--rate.*--advance.*--rename.*is required in structured mode/);
    });
});

Deno.test("structured session edit without mutation flags fails with guidance", async () => {
    await withTempDataDir(async (dir) => {
        await runStructured(["project", "new", "Acme", "25", "--project", "acme"], dir);
        // Start a session to have something to edit
        const { parsed: sessionParsed } = await runStructured(
            ["session", "start", "--project", "acme", "Testing"],
            dir,
        );
        assert(sessionParsed!.ok);
        const sessionData = sessionParsed!.data as { session: { ulid: string } };
        assert(sessionData.session.ulid, "expected a session ulid");

        const { code, parsed } = await runStructured([
            "session",
            "edit",
            "--project",
            "acme",
            "--session-id",
            sessionData.session.ulid,
        ], dir);
        assert(code !== 0, "expected non-zero exit code");
        assert(parsed !== null, "expected valid JSON error");
        assertEquals(parsed!.ok, false);
        assertMatch(parsed!.error!, /--start.*--end.*--remove-end.*--rename.*is required in structured mode/);
    });
});

Deno.test("structured memo edit without mutation flags fails with guidance", async () => {
    await withTempDataDir(async (dir) => {
        await runStructured(["project", "new", "Acme", "25", "--project", "acme"], dir);
        // Add a memo to have something to edit
        const { parsed: addParsed } = await runStructured(
            ["memo", "add", "TestNote", "--project", "acme"],
            dir,
        );
        assert(addParsed!.ok);
        const memoData = addParsed!.data as { memo: { id: string } };
        assert(memoData.memo.id, "expected a memo id");

        const { code, parsed } = await runStructured([
            "memo",
            "edit",
            "--project",
            "acme",
            "--memo-id",
            memoData.memo.id,
        ], dir);
        assert(code !== 0, "expected non-zero exit code");
        assert(parsed !== null, "expected valid JSON error");
        assertEquals(parsed!.ok, false);
        assertMatch(parsed!.error!, /--rename.*--description.*--type.*--cost.*is required in structured mode/);
    });
});

// ---------------------------------------------------------------------------
// 7. Structured status --short
// ---------------------------------------------------------------------------

Deno.test("structured status --short with active session returns parseable single envelope", async () => {
    await withTempDataDir(async (dir) => {
        await runStructured(["project", "new", "Acme", "25", "--project", "acme"], dir);
        await runStructured(["session", "start", "--project", "acme", "Coding"], dir);

        const { code, parsed } = await runStructured(["status", "--project", "acme", "--short"], dir);
        assertEquals(code, 0, "expected exit 0");
        assert(parsed !== null, "expected valid JSON");
        assert(parsed!.ok, "expected ok:true");
        const data = parsed!.data as Record<string, unknown>;
        assertEquals(data.active, true, "active should be true");
        assert(data.project !== undefined && (data.project as Record<string, unknown>).slug === "acme");
        assert(data.session !== null, "session should not be null when active");
        const session = data.session as Record<string, unknown>;
        assert(typeof session.elapsed === "number", "elapsed should be a number");
        assert(typeof session.elapsedFormatted === "string", "elapsedFormatted should be a string");
    });
});

Deno.test("structured status --short with no sessions returns parseable single envelope", async () => {
    await withTempDataDir(async (dir) => {
        await runStructured(["project", "new", "Acme", "25", "--project", "acme"], dir);

        const { code, parsed } = await runStructured(["status", "--project", "acme", "--short"], dir);
        assertEquals(code, 0, "expected exit 0");
        assert(parsed !== null, "expected valid JSON");
        assert(parsed!.ok, "expected ok:true");
        const data = parsed!.data as Record<string, unknown>;
        assertEquals(data.active, false, "active should be false when no sessions");
        assert(data.project !== undefined);
        assertEquals(data.session, null, "session should be null when no sessions");
    });
});

// ---------------------------------------------------------------------------
// 8. Project list enrichment
// ---------------------------------------------------------------------------

Deno.test("structured project list includes defaultProjectSlug and isDefault", async () => {
    await withTempDataDir(async (dir) => {
        await runStructured(["project", "new", "Acme", "25", "--project", "acme"], dir);
        await runStructured(["project", "new", "OtherCorp", "30", "--project", "othercorp"], dir);
        // Reset default back to acme (project new overwrites the default)
        await runStructured(["project", "default", "acme"], dir);

        const { code, parsed } = await runStructured(["project", "list"], dir);
        assertEquals(code, 0);
        assert(parsed!.ok);
        const data = parsed!.data as {
            defaultProjectSlug: string | null;
            projects: Array<{ slug: string; isDefault: boolean }>;
        };
        assertEquals(data.defaultProjectSlug, "acme", "defaultProjectSlug should be 'acme'");
        const acme = data.projects.find((p) => p.slug === "acme");
        assert(acme, "acme should be in the list");
        assertEquals(acme.isDefault, true, "acme should be the default");
        const other = data.projects.find((p) => p.slug === "othercorp");
        assert(other, "othercorp should be in the list");
        assertEquals(other.isDefault, false, "othercorp should not be default");
    });
});

Deno.test("structured project list with empty storage has null default and empty projects", async () => {
    await withTempDataDir(async (dir) => {
        const { code, parsed } = await runStructured(["project", "list"], dir);
        assertEquals(code, 0);
        assert(parsed!.ok);
        const data = parsed!.data as {
            defaultProjectSlug: string | null;
            projects: Array<unknown>;
        };
        assertEquals(data.defaultProjectSlug, null, "defaultProjectSlug should be null with empty storage");
        assertEquals(data.projects.length, 0, "projects should be empty");
    });
});

// ---------------------------------------------------------------------------
// 9. Session delete: validate --session-id exists
// ---------------------------------------------------------------------------

Deno.test("session delete with bogus --session-id and --yes fails with structured error", async () => {
    await withTempDataDir(async (dir) => {
        await runStructured(["project", "new", "Acme", "25", "--project", "acme"], dir);

        const { code, parsed } = await runStructured([
            "session",
            "delete",
            "--project",
            "acme",
            "--session-id",
            "01ARZ3NDEKTSV4RRFFQ69G5FAV",
            "--yes",
        ], dir);
        assertEquals(code, 1, "expected exit 1 for bogus session ID");
        assert(parsed !== null, "expected parseable structured error");
        assertEquals(parsed!.ok, false, "expected ok:false");
        assertMatch(
            parsed!.error!,
            /Session 01ARZ3NDEKTSV4RRFFQ69G5FAV does not exist in project acme\./,
            "error should indicate session does not exist",
        );
    });
});

// ---------------------------------------------------------------------------
// 10. Memo edit: --type expense --cost updates cost on existing expense
// ---------------------------------------------------------------------------

Deno.test("memo edit --type expense --cost on existing expense updates cost", async () => {
    await withTempDataDir(async (dir) => {
        await runStructured(["project", "new", "Acme", "25", "--project", "acme"], dir);

        // Create an expense memo with initial cost
        const addResult = await runStructured([
            "memo",
            "add",
            "Coffee",
            "--project",
            "acme",
            "--cost",
            "4.50",
        ], dir);
        assertEquals(addResult.code, 0);
        assert(addResult.parsed!.ok);
        const memoData = addResult.parsed!.data as { memo: { id: string; name: string; type: string } };
        assertEquals(memoData.memo.type, "expense");
        const memoId = memoData.memo.id;

        // Edit with --type expense --cost 50
        const editResult = await runStructured([
            "memo",
            "edit",
            "--project",
            "acme",
            "--memo-id",
            memoId,
            "--type",
            "expense",
            "--cost",
            "50",
        ], dir);
        assertEquals(editResult.code, 0, "expected exit 0 for valid cost update");
        assert(editResult.parsed!.ok, "expected ok:true");
        const editData = editResult.parsed!.data as { memo: { name: string; type: string } };
        assertEquals(editData.memo.name, "Coffee");
        assertEquals(editData.memo.type, "expense", "type should remain expense after cost update");
    });
});

// =========================================================================
// 11. Project createdAt / lastModified behaviour
// =========================================================================

/** Open the etu KV store for a test data directory for direct manipulation. */
async function openTestKv(dataDir: string): Promise<Deno.Kv> {
    const dbPath = path.join(dataDir, "etu", "etu.db");
    // Deno.openKv requires the parent directory to exist; it should already be
    // created by an earlier `project new` call.
    await Deno.mkdir(path.dirname(dbPath), { recursive: true });
    return await Deno.openKv(dbPath);
}

/**
 * Strip createdAt and lastModified from a project in the KV store so we can
 * simulate a legacy project record.
 */
async function stripProjectTimestamps(dataDir: string, slug: string): Promise<void> {
    const kv = await openTestKv(dataDir);
    const entry = await kv.get<Project>(["projects", slug]);
    if (!entry.value) {
        kv.close();
        return;
    }
    const { createdAt, lastModified, ...rest } = entry.value;
    await kv.set(["projects", slug], rest);
    kv.close();
}

/** Write a session directly to the KV store (bypassing the CLI). */
async function writeSession(dataDir: string, projectSlug: string, session: Session): Promise<string> {
    const kv = await openTestKv(dataDir);
    const sessionId = ulid();
    await kv.set(["projects", projectSlug, "sessions", sessionId], session);
    kv.close();
    return sessionId;
}

Deno.test("newly created project has createdAt and lastModified populated and equal", async () => {
    await withTempDataDir(async (dir) => {
        await runStructured(["project", "new", "Acme", "25", "--project", "acme"], dir);

        const { code, parsed } = await runStructured(["project", "list"], dir);
        assertEquals(code, 0);
        assert(parsed!.ok);
        const data = parsed!.data as { projects: Array<{ slug: string; createdAt?: number; lastModified?: number }> };
        const acme = data.projects.find((p) => p.slug === "acme");
        assert(acme, "acme should be in the list");
        assert(typeof acme.createdAt === "number", "createdAt should be a number");
        assert(typeof acme.lastModified === "number", "lastModified should be a number");
        assertEquals(acme.createdAt, acme.lastModified, "createdAt and lastModified should be equal at creation");
    });
});

Deno.test("project with zero sessions and no timestamp fields backfills both to now", async () => {
    await withTempDataDir(async (dir) => {
        // Create the project first (so KV file exists), then strip timestamps
        await runStructured(["project", "new", "ZeroSec", "30", "--project", "zerosec"], dir);
        await stripProjectTimestamps(dir, "zerosec");

        const before = Date.now();
        const { code, parsed } = await runStructured(["project", "list"], dir);
        assertEquals(code, 0);
        assert(parsed!.ok);
        const data = parsed!.data as { projects: Array<{ slug: string; createdAt?: number; lastModified?: number }> };
        const project = data.projects.find((p) => p.slug === "zerosec");
        assert(project, "zerosec should be in the list");
        assert(typeof project.createdAt === "number", "createdAt should be backfilled");
        assert(typeof project.lastModified === "number", "lastModified should be backfilled");
        assertEquals(project.createdAt, project.lastModified, "backfilled timestamps should be equal");
        // Should be close to "now" (within a generous tolerance)
        const tolerance = 10_000; // 10 seconds
        assert(
            project.createdAt! >= before && project.createdAt! <= Date.now() + 1000,
            `createdAt ${project.createdAt} should be >= ${before} and close to now`,
        );
        assert(
            Math.abs(project.lastModified! - project.createdAt!) < tolerance,
            "lastModified should be within tolerance of createdAt",
        );
    });
});

Deno.test("project with sessions but no timestamp fields backfills from session data", async () => {
    await withTempDataDir(async (dir) => {
        // Create project first so the KV file and directory structure exist
        await runStructured(["project", "new", "Legacy", "40", "--project", "legacy"], dir);

        // Write two sessions directly to the KV with known start/end timestamps
        const past1Start = Date.now() - 1_000_000; // ~16 min ago
        const past1End = past1Start + 100_000;
        const past2Start = Date.now() - 100_000;  // ~2 min ago
        const past2End = past2Start + 50_000;

        await writeSession(dir, "legacy", { name: "Session1", start: past1Start, end: past1End });
        await writeSession(dir, "legacy", { name: "Session2", start: past2Start, end: past2End });

        // Strip timestamps from the project
        await stripProjectTimestamps(dir, "legacy");

        // Listing should trigger backfill
        const { code, parsed } = await runStructured(["project", "list"], dir);
        assertEquals(code, 0);
        assert(parsed!.ok);
        const data = parsed!.data as { projects: Array<{ slug: string; createdAt?: number; lastModified?: number }> };
        const project = data.projects.find((p) => p.slug === "legacy");
        assert(project, "legacy should be in the list");
        assert(typeof project.createdAt === "number", "createdAt should be backfilled");
        assert(typeof project.lastModified === "number", "lastModified should be backfilled");

        // createdAt = earliest session start (past1Start is older)
        assertEquals(project.createdAt, past1Start, "createdAt should be the earliest session start");
        // lastModified = latest session activity (past2End is most recent)
        assertEquals(project.lastModified, past2End, "lastModified should be the latest session end");
    });
});

Deno.test("session operations bump only the affected project's lastModified", async () => {
    await withTempDataDir(async (dir) => {
        // Create two projects
        await runStructured(["project", "new", "ProjectA", "30", "--project", "proja"], dir);
        await runStructured(["project", "new", "ProjectB", "25", "--project", "projb"], dir);

        // Get initial timestamps
        const list0 = await runStructured(["project", "list"], dir);
        assert(list0.parsed!.ok);
        const initial = (list0.parsed!.data as {
            projects: Array<{ slug: string; createdAt: number; lastModified: number }>;
        }).projects;
        const a0 = initial.find((p) => p.slug === "proja")!;
        const b0 = initial.find((p) => p.slug === "projb")!;

        // Start a session on Project A (bumps lastModified)
        const startResult = await runStructured(["session", "start", "--project", "proja", "Work"], dir);
        assert(startResult.parsed!.ok);
        const sessionUlid = (startResult.parsed!.data as { session: { ulid: string } }).session.ulid;

        // Wait a tiny bit to ensure timestamps differ
        await new Promise((r) => setTimeout(r, 10));

        const list1 = await runStructured(["project", "list"], dir);
        assert(list1.parsed!.ok);
        const afterStart = (list1.parsed!.data as {
            projects: Array<{ slug: string; createdAt: number; lastModified: number }>;
        }).projects;
        const a1 = afterStart.find((p) => p.slug === "proja")!;
        const b1 = afterStart.find((p) => p.slug === "projb")!;
        assert(a1.lastModified > a0.lastModified, "Project A lastModified should increase after session start");
        assertEquals(b1.lastModified, b0.lastModified, "Project B lastModified should not change after session start on A");

        // Stop the session on Project A
        await runStructured(["session", "stop", "--project", "proja"], dir);
        await new Promise((r) => setTimeout(r, 10));

        const list2 = await runStructured(["project", "list"], dir);
        assert(list2.parsed!.ok);
        const afterStop = (list2.parsed!.data as {
            projects: Array<{ slug: string; createdAt: number; lastModified: number }>;
        }).projects;
        const a2 = afterStop.find((p) => p.slug === "proja")!;
        const b2 = afterStop.find((p) => p.slug === "projb")!;
        assert(a2.lastModified > a1.lastModified, "Project A lastModified should increase after session stop");
        assertEquals(b2.lastModified, b1.lastModified, "Project B lastModified should not change after session stop on A");

        // Edit the session on Project A (flag-driven path)
        await runStructured([
            "session", "edit", "--project", "proja", "--session-id", sessionUlid, "--rename", "WorkRenamed",
        ], dir);
        await new Promise((r) => setTimeout(r, 10));

        const list3 = await runStructured(["project", "list"], dir);
        assert(list3.parsed!.ok);
        const afterEdit = (list3.parsed!.data as {
            projects: Array<{ slug: string; createdAt: number; lastModified: number }>;
        }).projects;
        const a3 = afterEdit.find((p) => p.slug === "proja")!;
        const b3 = afterEdit.find((p) => p.slug === "projb")!;
        assert(a3.lastModified > a2.lastModified, "Project A lastModified should increase after session edit");
        assertEquals(b3.lastModified, b2.lastModified, "Project B lastModified should not change after session edit on A");
    });
});

// =========================================================================
// 12. Paginated structured project list
// =========================================================================

/** Set a project's lastModified timestamp directly in the KV store. */
async function setProjectLastModified(dataDir: string, slug: string, ts: number): Promise<void> {
    const kv = await openTestKv(dataDir);
    const entry = await kv.get<Project>(["projects", slug]);
    if (entry.value) {
        await kv.set(["projects", slug], { ...entry.value, lastModified: ts });
    }
    kv.close();
}

/**
 * Create N projects with sequential slugs in the test directory.
 * Returns the list of slugs (p01, p02, …).
 * Each project gets a rate of 25 and no advance.
 */
async function createManyProjects(dataDir: string, count: number): Promise<string[]> {
    const slugs: string[] = [];
    for (let i = 1; i <= count; i++) {
        const slug = `p${String(i).padStart(2, "0")}`;
        const result = await runStructured(["project", "new", slug, "25", "--project", slug], dataDir);
        if (result.code !== 0) throw new Error(`Failed to create project ${slug}: ${JSON.stringify(result.parsed)}`);
        slugs.push(slug);
        // Small delay to ensure distinct creation timestamps
        await new Promise((r) => setTimeout(r, 2));
    }
    return slugs;
}

interface PaginatedListData {
    defaultProjectSlug: string | null;
    projects: Array<{ slug: string; lastModified: number; isDefault: boolean }>;
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
}

Deno.test("structured project list page 1 returns 10 projects sorted by lastModified desc", async () => {
    await withTempDataDir(async (dir) => {
        const slugs = await createManyProjects(dir, 15);
        // Set explicit lastModified values: p01=1, p02=2, ..., p15=15
        for (let i = 0; i < slugs.length; i++) {
            await setProjectLastModified(dir, slugs[i], i + 1);
        }

        const { code, parsed } = await runStructured(["project", "list", "--page", "1"], dir);
        assertEquals(code, 0);
        assert(parsed!.ok);
        const data = parsed!.data as PaginatedListData;
        assertEquals(data.page, 1);
        assertEquals(data.pageSize, 10);
        assertEquals(data.totalItems, 15);
        assertEquals(data.totalPages, 2);
        assertEquals(data.projects.length, 10, "page 1 should have 10 projects");

        // Should be sorted by lastModified descending: p15 first (ts=15), p06 last (ts=6)
        const expectedFirst = "p15";
        const expectedLast = "p06";
        assertEquals(data.projects[0].slug, expectedFirst, "first project on page 1 should be most recently modified");
        assertEquals(data.projects[9].slug, expectedLast, "10th project on page 1 should be the 10th most recent");

        // Verify monotonic non-increasing lastModified
        for (let i = 1; i < data.projects.length; i++) {
            assert(
                data.projects[i - 1].lastModified >= data.projects[i].lastModified,
                `lastModified should be non-increasing (position ${i - 1}=${data.projects[i - 1].lastModified} vs ${i}=${data.projects[i].lastModified})`,
            );
        }
    });
});

Deno.test("structured project list page 2 returns remaining projects", async () => {
    await withTempDataDir(async (dir) => {
        const slugs = await createManyProjects(dir, 15);
        for (let i = 0; i < slugs.length; i++) {
            await setProjectLastModified(dir, slugs[i], i + 1);
        }

        const { code, parsed } = await runStructured(["project", "list", "--page", "2"], dir);
        assertEquals(code, 0);
        assert(parsed!.ok);
        const data = parsed!.data as PaginatedListData;
        assertEquals(data.page, 2);
        assertEquals(data.pageSize, 10);
        assertEquals(data.totalItems, 15);
        assertEquals(data.totalPages, 2);
        assertEquals(data.projects.length, 5, "page 2 should have 5 remaining projects");

        // Page 2 should have p05 (ts=5) down to p01 (ts=1)
        const expectedFirst = "p05";
        const expectedLast = "p01";
        assertEquals(data.projects[0].slug, expectedFirst, "first project on page 2 should be the 11th most recent");
        assertEquals(data.projects[4].slug, expectedLast, "last project on page 2 should be the least recently modified");

        // Verify monotonic non-increasing lastModified
        for (let i = 1; i < data.projects.length; i++) {
            assert(
                data.projects[i - 1].lastModified >= data.projects[i].lastModified,
                `lastModified should be non-increasing on page 2 (position ${i - 1} vs ${i})`,
            );
        }
    });
});

Deno.test("structured project list with out-of-range page returns empty projects with correct metadata", async () => {
    await withTempDataDir(async (dir) => {
        const slugs = await createManyProjects(dir, 15);
        for (let i = 0; i < slugs.length; i++) {
            await setProjectLastModified(dir, slugs[i], i + 1);
        }

        const { code, parsed } = await runStructured(["project", "list", "--page", "100"], dir);
        assertEquals(code, 0, "out-of-range page should not error");
        assert(parsed!.ok);
        const data = parsed!.data as PaginatedListData;
        assertEquals(data.page, 100);
        assertEquals(data.pageSize, 10);
        assertEquals(data.totalItems, 15);
        assertEquals(data.totalPages, 2);
        assertEquals(data.projects.length, 0, "out-of-range page should return empty projects");
    });
});

Deno.test("structured project list with invalid --page fails cleanly", async () => {
    await withTempDataDir(async (dir) => {
        // Non-numeric
        const { code: code1, parsed: p1 } = await runStructured(["project", "list", "--page", "abc"], dir);
        assert(code1 !== 0, "non-numeric page should fail");
        assert(p1 !== null && !p1.ok, "should return ok:false");
        assertMatch(p1!.error!, /Invalid page.*"abc".*positive integer/, "should mention the invalid value");

        // Zero
        const { code: code2, parsed: p2 } = await runStructured(["project", "list", "--page", "0"], dir);
        assert(code2 !== 0, "page=0 should fail");
        assert(p2 !== null && !p2.ok, "should return ok:false");
        assertMatch(p2!.error!, /Invalid page.*"0".*positive integer/, "should mention the invalid value");

        // Negative
        const { code: code3, parsed: p3 } = await runStructured(["project", "list", "--page", "-1"], dir);
        assert(code3 !== 0, "negative page should fail");
        assert(p3 !== null && !p3.ok, "should return ok:false");
        assertMatch(p3!.error!, /Invalid page.*"-1".*positive integer/, "should mention the invalid value");
    });
});

Deno.test("structured project list with empty storage returns sane metadata", async () => {
    await withTempDataDir(async (dir) => {
        const { code, parsed } = await runStructured(["project", "list"], dir);
        assertEquals(code, 0);
        assert(parsed!.ok);
        const data = parsed!.data as PaginatedListData;
        assertEquals(data.defaultProjectSlug, null);
        assertEquals(data.projects.length, 0);
        assertEquals(data.page, 1);
        assertEquals(data.pageSize, 10);
        assertEquals(data.totalItems, 0);
        assertEquals(data.totalPages, 0);
    });
});
