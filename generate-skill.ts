// Regenerates the "Command reference" section of an etu skill markdown file
// by walking the live `etu --help` command tree and splicing the raw output
// between a pair of hand-written marker comments.
//
// Usage:
//   deno run --allow-run=etu --allow-read --allow-write generate-skill.ts <path-to-skill-md>

const BEGIN_MARKER_PREFIX = "<!-- BEGIN GENERATED:";
const END_MARKER_LINE = "<!-- END GENERATED -->";

interface CommandNode {
    /** Full path of subcommand names from the root, e.g. ["session", "delete"]. Empty for root. */
    path: string[];
    /** Depth in the tree. 0 for root. */
    depth: number;
    /** Raw stdout of `etu <path...> --help`. */
    helpText: string;
    children: CommandNode[];
}

function expandHome(path: string): string {
    if (!path.startsWith("~")) return path;
    const home = Deno.env.get("HOME");
    if (!home) {
        console.error("Cannot expand '~' in path: HOME environment variable is not set.");
        Deno.exit(1);
    }
    return home + path.slice(1);
}

async function runEtuHelp(path: string[]): Promise<string> {
    const command = new Deno.Command("etu", {
        args: [...path, "--help"],
        stdout: "piped",
        stderr: "piped",
    });
    const { stdout } = await command.output();
    return new TextDecoder().decode(stdout);
}

async function runEtuVersion(): Promise<string> {
    const command = new Deno.Command("etu", {
        args: ["--version"],
        stdout: "piped",
        stderr: "piped",
    });
    const { stdout } = await command.output();
    return new TextDecoder().decode(stdout).trim();
}

/**
 * Parses the `Commands:` section of a `--help` output and returns the
 * subcommand names it lists, in order. Excludes the synthetic "help" entry.
 */
function parseSubcommandNames(helpText: string): string[] {
    const lines = helpText.split("\n");
    const names: string[] = [];
    let inCommands = false;

    for (const line of lines) {
        if (!inCommands) {
            if (line === "Commands:") inCommands = true;
            continue;
        }

        if (line.trim() === "") break;

        const match = line.match(/^ {2}(\S+)/);
        if (match) {
            names.push(match[1]);
            continue;
        }

        // Unindented line: a new (unindented) section header. Stop.
        if (/^\S/.test(line)) break;

        // Otherwise: a more-indented wrapped description continuation. Ignore.
    }

    return names.filter((name) => name !== "help");
}

async function walk(path: string[], depth: number): Promise<CommandNode> {
    const helpText = await runEtuHelp(path);
    const subcommandNames = parseSubcommandNames(helpText);

    const children: CommandNode[] = [];
    for (const name of subcommandNames) {
        children.push(await walk([...path, name], depth + 1));
    }

    return { path, depth, helpText, children };
}

function countCommands(node: CommandNode): number {
    let count = node.depth > 0 ? 1 : 0;
    for (const child of node.children) {
        count += countCommands(child);
    }
    return count;
}

/** Option names that should be excluded from generated skill documentation. */
const HIDDEN_OPTIONS = new Set(["--yes"]);

/**
 * Strips selected option rows (and their continuation lines) from the
 * `Options:` block of a `--help` output. Only modifies lines within the
 * Options block; everything else passes through unchanged.
 */
function filterHiddenOptions(helpText: string): string {
    const lines = helpText.split("\n");
    const result: string[] = [];
    let inOptions = false;
    let skipping = false;

    for (const line of lines) {
        if (!inOptions) {
            if (line === "Options:") inOptions = true;
            result.push(line);
            continue;
        }

        // End of Options block: blank line or unindented (section header).
        if (line.trim() === "" || (line.length > 0 && line[0] !== " ")) {
            inOptions = false;
            skipping = false;
            result.push(line);
            continue;
        }

        // An option row starts with exactly two spaces then `-` or `--`.
        const isOptionLine = /^  --/.test(line) || /^  -\w/.test(line);

        if (isOptionLine) {
            const optMatch = line.match(/^  (--\S+)/);
            if (optMatch && HIDDEN_OPTIONS.has(optMatch[1])) {
                skipping = true;
                continue; // drop this row
            }
            skipping = false;
        } else if (skipping && /^ {3,}/.test(line)) {
            // Continuation line of a hidden option — drop it.
            continue;
        }

        result.push(line);
    }

    return result.join("\n");
}

function formatBlock(heading: string, helpText: string): string {
    const filtered = filterHiddenOptions(helpText);
    const trimmed = filtered.replace(/\s+$/, "");
    return `${heading}\n\`\`\`\n${trimmed}\n\`\`\``;
}

function collectBlocks(node: CommandNode): string[] {
    const blocks: string[] = [];

    if (node.depth > 0) {
        const level = node.depth + 2;
        const heading = `${"#".repeat(level)} \`etu ${node.path.join(" ")}\``;
        blocks.push(formatBlock(heading, node.helpText));
    }

    for (const child of node.children) {
        blocks.push(...collectBlocks(child));
    }

    return blocks;
}

function buildGeneratedContent(root: CommandNode, version: string): string {
    const parts: string[] = [];
    parts.push(`_Generated ${new Date().toISOString()} from \`etu ${version}\`._`);
    parts.push(formatBlock("### Global usage", root.helpText));
    parts.push(...collectBlocks(root));
    return parts.join("\n\n");
}

function spliceIntoFile(originalContent: string, generatedContent: string): string {
    const lines = originalContent.split("\n");

    const beginIdx = lines.findIndex((line) => line.startsWith(BEGIN_MARKER_PREFIX));
    const endIdx = lines.findIndex((line) => line === END_MARKER_LINE);

    if (beginIdx === -1) {
        console.error(
            `Could not find BEGIN marker (a line starting with "${BEGIN_MARKER_PREFIX}") in the target file.`,
        );
        Deno.exit(1);
    }
    if (endIdx === -1) {
        console.error(`Could not find END marker (a line exactly "${END_MARKER_LINE}") in the target file.`);
        Deno.exit(1);
    }
    if (endIdx < beginIdx) {
        console.error("END marker appears before BEGIN marker in the target file.");
        Deno.exit(1);
    }

    let commentCloseIdx = -1;
    for (let i = beginIdx; i < endIdx; i++) {
        if (lines[i].includes("-->")) {
            commentCloseIdx = i;
            break;
        }
    }
    if (commentCloseIdx === -1) {
        console.error("Could not find the closing '-->' of the BEGIN marker's HTML comment before the END marker.");
        Deno.exit(1);
    }

    const before = lines.slice(0, commentCloseIdx + 1).join("\n");
    const after = lines.slice(endIdx).join("\n");

    return `${before}\n\n${generatedContent}\n\n${after}`;
}

async function main() {
    const [targetPathArg] = Deno.args;
    if (!targetPathArg || Deno.args.length !== 1) {
        console.error(
            "Usage: deno run --allow-run=etu --allow-read --allow-write generate-skill.ts <path-to-skill-md>",
        );
        Deno.exit(1);
    }

    const targetPath = expandHome(targetPathArg);

    let originalContent: string;
    try {
        originalContent = await Deno.readTextFile(targetPath);
    } catch (_err) {
        console.error(`Target file does not exist: ${targetPath}`);
        Deno.exit(1);
        return;
    }

    const version = await runEtuVersion();
    const root = await walk([], 0);
    const generatedContent = buildGeneratedContent(root, version);

    const newContent = spliceIntoFile(originalContent, generatedContent);
    await Deno.writeTextFile(targetPath, newContent);

    const commandCount = countCommands(root);
    const byteSize = new TextEncoder().encode(newContent).length;
    console.log(`Wrote ${targetPath} (${commandCount} commands captured, ${byteSize} bytes).`);
}

if (import.meta.main) {
    await main();
}
