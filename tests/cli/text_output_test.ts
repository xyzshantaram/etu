/**
 * Regression tests for etu's text output mode and generator filtering.
 * Covers: non-structured text output and SKILL.md --yes filtering.
 */
import { runEtu, withTempDataDir } from "../test_helpers.ts";
import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import * as path from "@std/path";

/** Root of the etu repository, computed relative to this file. */
const REPO_ROOT = new URL("../..", import.meta.url).pathname;

// ---------------------------------------------------------------------------
// 6. Text-mode non-regression
// ---------------------------------------------------------------------------

Deno.test("project list without --structured produces human-readable table, not JSON envelope", async () => {
    await withTempDataDir(async (dir) => {
        // Create project with structured mode (so we get a clean exit code)
        const { code: newCode } = await runEtu(
            ["--structured", "project", "new", "Acme", "25", "--project", "acme"],
            dir,
        );
        assertEquals(newCode, 0);

        // Run project list WITHOUT --structured
        const { code, stdout } = await runEtu(["project", "list"], dir);
        assertEquals(code, 0, "project list should succeed");

        // Should contain human-readable table text
        assert(stdout.includes("Acme"), "should contain project name");
        assert(stdout.includes("acme"), "should contain project slug");
        assert(stdout.includes("25/hr"), "should contain rate");

        // Must NOT be parseable as structured JSON envelope
        let isStructuredEnvelope = false;
        try {
            const parsed = JSON.parse(stdout.trim());
            if (parsed && typeof parsed === "object" && parsed.ok !== undefined) {
                isStructuredEnvelope = true;
            }
        } catch {
            // Not JSON at all — that's fine
        }
        assert(!isStructuredEnvelope, "text output should not be the structured JSON envelope { ok: true, ... }");
    });
});

// ---------------------------------------------------------------------------
// 7. Generator filtering
// ---------------------------------------------------------------------------

Deno.test("generate-skill.ts strips --yes from generated block; raw help includes --yes", async () => {
    // Build a minimal temp skill fixture with valid BEGIN/END markers.
    const dir = await Deno.makeTempDir({ prefix: "etu-gen-test-" });
    const tempSkillPath = path.join(dir, "SKILL.md");
    const fixtureContent = [
        "# Skill fixture",
        "intro text here",
        "<!-- BEGIN GENERATED: manual-edits-below -->",
        "",
        "<!-- END GENERATED -->",
        "",
        "## Hand-written footer",
        "This content should not be touched by the generator.",
        "",
    ].join("\n");

    try {
        await Deno.writeTextFile(tempSkillPath, fixtureContent);

        // Run generate-skill.ts on the temp fixture
        const genCmd = new Deno.Command(Deno.execPath(), {
            cwd: REPO_ROOT,
            args: [
                "run",
                "--allow-run=etu",
                "--allow-env=HOME",
                "--allow-read",
                "--allow-write",
                "generate-skill.ts",
                tempSkillPath,
            ],
            stdout: "piped",
            stderr: "piped",
        });
        const { code: genCode, stderr: genErr } = await genCmd.output();
        const genStderr = new TextDecoder().decode(genErr);
        assertEquals(genCode, 0, `generate-skill.ts should succeed. stderr: ${genStderr}`);

        // Read the generated file and extract the generated block (between markers)
        const generatedContent = await Deno.readTextFile(tempSkillPath);
        const beginMarker = "<!-- BEGIN GENERATED:";
        const endMarker = "<!-- END GENERATED -->";
        const beginIdx = generatedContent.indexOf(beginMarker);
        const endIdx = generatedContent.indexOf(endMarker);
        assert(beginIdx !== -1, "generated file should contain BEGIN marker");
        assert(endIdx !== -1, "generated file should contain END marker");

        const generatedBlock = generatedContent.slice(beginIdx, endIdx + endMarker.length);

        // The generated block must NOT contain --yes (stripped by filterHiddenOptions)
        assert(
            !generatedBlock.includes("--yes"),
            "generated SKILL block should NOT contain --yes",
        );

        // Hand-written footer must survive intact
        assertStringIncludes(
            generatedContent,
            "This content should not be touched by the generator.",
            "hand-written footer should survive",
        );
    } finally {
        await Deno.remove(dir, { recursive: true });
    }

    // Raw `etu session delete --help` DOES contain --yes
    await withTempDataDir(async (dir) => {
        const { stdout: helpOut } = await runEtu(["session", "delete", "--help"], dir);
        assertStringIncludes(
            helpOut,
            "--yes",
            "raw `session delete --help` should include --yes",
        );
    });
});
