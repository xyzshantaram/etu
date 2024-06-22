import { Command } from "@/commander";
import { match } from "@/oxide";
import { getProjectId, scream } from "../../utils.ts";
import * as storage from "../../storage.ts";

interface EEditOpts {
    id: string;
}

const currency = await storage.getConfigValue('currency');
const action = async ({ id }: EEditOpts) => {
    return await match(await getProjectId(id), {
        Err: (msg: string) => scream(msg),
        Ok: async (id: string) => {
            const project = (await storage.getProjectById(id)).unwrapOrElse(() => scream(`Project ${id} does not exist.`));
            console.log(`**** Current settings for project \`${project.slug}\`:`);
            console.log(`Name: ${project.name}`);
            console.log(`Hourly rate: ${currency}${project.rate}/hr`);
            console.log('');
            const ask = 'What would you like to do?\n[c]hange rate\n[r]ename\n[e]xit>';
            let inp = '';
            while (inp !== 'e') {
                while (!['c', 'r', 'e'].includes(inp)) inp = prompt(ask) || '';
                if (inp === 'c') {
                    let rate = NaN;
                    while (isNaN(rate)) rate = parseInt(prompt('What do you want to set the rate to?') || '');
                    await storage.putProject({ ...project, rate });
                    console.log("Updated successfully.");
                    inp = '';
                }
                if (inp === 'r') {
                    let name = '';
                    while (name.trim() === '') {
                        name = prompt('What would you like to rename this project to?') || '';
                    }
                    await storage.putProject({ ...project, name });
                    console.log("Updated successfully.");
                }
            }
        },
    });
};


export const edit = new Command("edit").option(
    "-p --project <string>",
    "id of the project to edit. Uses the default if not specified.",
)
    .description("Edit a project.")
    .action(action);
