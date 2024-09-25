import { Command } from "@/commander";
import * as storage from "../../storage.ts";
import { heading, info, muted, success } from "../../utils.ts";
import { Table } from "@/cliffy/table";

const currency = await storage.getConfigValue("currency");

const action = async () => {
    let count = 0;
    const t = new Table().header(["Project", "ID", "Rate", "Advance"]).border(true);
    for await (const project of storage.getProjects()) {
        t.push([

            heading(project.name),
            muted(project.slug),
            success(`${currency}${project.rate}/hr`),
            info(`${project.advance || 0} h`)
        ]);
        count += 1;
    }

    if (count === 0) {
        console.log("No projects found. Create one with `etu project new`.");
    }

    t.render();
};

export const list = new Command("list")
    .description("List all projects.")
    .action(action);
