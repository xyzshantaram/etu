import { Command } from "@/commander";
import { match } from "@/oxide";
import { getProjectId, heading, scream, success } from "../../utils.ts";
import * as storage from "../../storage.ts";
import { Input, Number, Select } from "@/cliffy/prompt";

interface EEditOpts {
    project: string;
}

const currency = await storage.getConfigValue("currency");
const action = async function ({ project }: EEditOpts) {
    return await match(await getProjectId(project), {
        Err: (msg: string) => scream(msg),
        Ok: async (id: string) => {
            const project = (await storage.getProjectById(id)).unwrapOrElse(() =>
                scream(`Project ${id} does not exist.`)
            );
            console.log(heading(`**** Current settings for project \`${project.slug}\` ****`));
            console.log(`${success("Name")}: ${project.name}`);
            console.log(`${success("Hourly rate")}: ${currency}${project.rate}/hr`);
            console.log(`${success("Advance amount:")}: ${project.advance || 0} hours`);
            console.log("");

            let inp = "";
            while (inp !== "exit") {
                inp = await Select.prompt<string>({
                    message: "What would you like to do?",
                    options: ["change rate", "set advance", "rename", "exit"],
                });

                if (inp === "change rate") {
                    const rate = await Number.prompt({
                        message: "New rate?",
                        float: false,
                        min: 0,
                    });
                    await storage.putProject({ ...project, rate });
                } else if (inp === "set advance") {
                    const advance = await Number.prompt({
                        message: "Advance amount (in hours)",
                        float: false,
                        min: 0,
                    });
                    await storage.putProject({ ...project, advance });
                } else if (inp === "rename") {
                    const name = await Input.prompt({ message: "", validate: (s) => s.trim() !== "" });
                    await storage.putProject({ ...project, name });
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
