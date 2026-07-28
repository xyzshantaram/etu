/**
 * Regression tests for etu's --structured output mode.
 * Covers: global structured output, config, project edit clobbering,
 * memo flags, delete safety, required target IDs,
 * structured edit guards, structured status --short, and project-list enrichment.
 */
import { runEtu, runStructured, withTempDataDir } from "../test_helpers.ts";
import { assert, assertEquals, assertMatch } from "jsr:@std/assert@1";

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
