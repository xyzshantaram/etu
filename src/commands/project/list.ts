import { Command } from "@/commander";
import * as storage from "../../storage.ts";
import { heading, info } from "../../utils.ts";

const currency = await storage.getConfigValue("currency");

const action = async () => {
    let count = 0;
    for await (const project of storage.getProjects()) {
        const header = `**** ${project.name} ****`;
        console.log(heading(header));
        console.log(info(`ID: ${project.slug}`));
        console.log(info(`Rate: ${currency}${project.rate}/hr`));
        console.log("*".repeat(header.length));
        count += 1;
    }

    if (count === 0) {
        console.log("No projects found. Create one with `etu project new`.");
    }
};

export const list = new Command("list")
    .description("List all projects.")
    .action(action);
