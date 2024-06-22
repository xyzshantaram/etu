import { Command } from "@/commander";
import * as storage from "../../storage.ts";
import { heading, info } from "../../utils.ts";

const currency = await storage.getConfigValue("currency");

const action = async () => {
    let count = 0;
    for await (const project of storage.getProjects()) {
        const header = `**** ${heading(project.name)} ****`;
        const rate = info(`${currency}${project.rate}/hr`);
        console.log(header);
        console.log(`ID: ${info(project.slug)}`);
        console.log(`Rate: ${rate}`);
        console.log(`Advance: ${info(`${project.advance || 0} h`)}`);
        console.log("*".repeat(project.name.length + 10));
        count += 1;
    }

    if (count === 0) {
        console.log("No projects found. Create one with `etu project new`.");
    }
};

export const list = new Command("list")
    .description("List all projects.")
    .action(action);
