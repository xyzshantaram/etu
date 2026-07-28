import { Command } from "commander";
import * as storage from "@/storage.ts";
import { heading, info, muted, respond, success } from "@/utils.ts";
import { Table } from "@cliffy/table";

const currency = await storage.getConfigValue("currency");

const action = async (_opts: any, cmd: Command) => {
    const projects: Array<{
        name: string;
        slug: string;
        rate: number;
        advance: number;
        elapsed: number;
        income: number;
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
        });
    }

    if ((cmd.optsWithGlobals() as Record<string, unknown>).structured) {
        const defaultSlug = await storage.getDefaultProject();
        const defaultProjectSlug: string | null = defaultSlug.isNone() ? null : defaultSlug.unwrap();
        const enriched = projects.map((p) => ({
            ...p,
            isDefault: p.slug === defaultProjectSlug,
        }));
        respond(cmd, () => {}, { defaultProjectSlug, projects: enriched });
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
    .action(action);
