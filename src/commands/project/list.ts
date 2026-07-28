import { Command } from "commander";
import * as storage from "@/storage.ts";
import { fail, heading, info, muted, respond, success } from "@/utils.ts";
import { Table } from "@cliffy/table";

const currency = await storage.getConfigValue("currency");

const action = async ({ page: pageStr }: { page?: string }, cmd: Command) => {
    let page = 1;
    if (pageStr !== undefined) {
        page = +pageStr;
        if (isNaN(page) || !Number.isInteger(page) || page < 1) {
            fail(cmd, `Invalid page: "${pageStr}". Must be a positive integer.`);
        }
    }

    const projects: Array<{
        name: string;
        slug: string;
        rate: number;
        advance: number;
        elapsed: number;
        income: number;
        createdAt?: number;
        lastModified?: number;
    }> = [];

    for await (const project of storage.getProjects()) {
        let elapsed = 0;
        for await (const session of storage.getSessions(project.slug)) {
            elapsed += (session.value.end ?? Date.now()) - session.value.start;
        }
        const income = (elapsed / 3600000) * project.rate;

        projects.push({
            name: project.name,
            slug: project.slug,
            rate: project.rate,
            advance: project.advance || 0,
            elapsed,
            income,
            createdAt: project.createdAt,
            lastModified: project.lastModified,
        });
    }

    if ((cmd.optsWithGlobals() as Record<string, unknown>).structured) {
        const defaultSlug = await storage.getDefaultProject();
        const defaultProjectSlug: string | null = defaultSlug.isNone() ? null : defaultSlug.unwrap();
        const enriched = projects.map((p) => ({
            ...p,
            isDefault: p.slug === defaultProjectSlug,
        }));

        // Sort by lastModified descending (most recent first).
        // Projects missing lastModified (should not happen post-backfill) sort last.
        enriched.sort((a, b) => (b.lastModified ?? 0) - (a.lastModified ?? 0));

        const pageSize = 10;
        const totalItems = enriched.length;
        const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);
        const start = (page - 1) * pageSize;
        const paginated = enriched.slice(start, start + pageSize);

        respond(cmd, () => {}, {
            defaultProjectSlug,
            projects: paginated,
            page,
            pageSize,
            totalItems,
            totalPages,
        });
        return;
    }

    if (projects.length === 0) {
        console.log("No projects found. Create one with `etu project new`.");
        return;
    }

    const t = new Table().header(["Project", "ID", "Rate", "Advance", "Income"]).border(true);
    for (const p of projects) {
        t.push([
            heading(p.name),
            muted(p.slug),
            success(`${currency}${p.rate}/hr`),
            info(`${p.advance} h`),
            success(`${currency}${p.income.toFixed(2)}`),
        ]);
    }
    t.render();
};

export const list = new Command("list")
    .description("List all projects.")
    .option("--page <n>", "Page number for paginated output (structured mode only). Default: 1.")
    .action(action);
