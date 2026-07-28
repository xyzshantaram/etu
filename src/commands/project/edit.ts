import { Command } from "commander";
import { match } from "@/oxide";
import { fail, getProjectId, heading, respond, success } from "@/utils.ts";
import * as storage from "@/storage.ts";
import { Input, Number, Select } from "@cliffy/prompt";

interface EEditOpts {
    project: string;
    rate?: string;
    advance?: string;
    rename?: string;
}

const currency = await storage.getConfigValue("currency");
const action = async function ({ project, rate, advance, rename }: EEditOpts, cmd: Command) {
    return await match(await getProjectId(project), {
        Err: (msg: string) => fail(cmd, msg),
        Ok: async (id: string) => {
            const project = (await storage.getProjectById(id)).unwrapOrElse(() =>
                fail(cmd, `Project ${id} does not exist.`)
            );
            let updatedProject = { ...project };

            const hasFlags = rate !== undefined || advance !== undefined || rename !== undefined;

            if ((cmd.optsWithGlobals() as Record<string, unknown>).structured && !hasFlags) {
                fail(cmd, "--rate, --advance, and/or --rename is required in structured mode.");
            }

            if (hasFlags) {
                if (rate !== undefined) {
                    const rateNum = +rate;
                    if (isNaN(rateNum) || rateNum < 0) {
                        fail(cmd, `Invalid rate: "${rate}". Must be a non-negative number.`);
                    }
                    updatedProject.rate = rateNum;
                }
                if (advance !== undefined) {
                    const advanceNum = +advance;
                    if (isNaN(advanceNum) || advanceNum < 0) {
                        fail(cmd, `Invalid advance: "${advance}". Must be a non-negative number.`);
                    }
                    updatedProject.advance = advanceNum;
                }
                if (rename !== undefined) {
                    if (rename.trim() === "") fail(cmd, "Project name cannot be empty.");
                    updatedProject.name = rename;
                }

                await storage.putProject(updatedProject);
                await storage.touchProject(id);
                const updated = await storage.getProjectById(id);
                respond(cmd, (data) => {
                    console.log(data.message);
                }, {
                    message: "Edit complete.",
                    project: { name: updated.unwrap().name, slug: updated.unwrap().slug, rate: updated.unwrap().rate },
                });
                return;
            }

            console.log(heading(`**** Current settings for project \`${project.slug}\` ****`));
            console.log(`${success("Name")}: ${project.name}`);
            console.log(`${success("Hourly rate")}: ${currency}${project.rate}/hr`);
            console.log(`${success("Advance amount:")}: ${project.advance || 0} h`);
            console.log("");

            let inp = "";
            while (inp !== "exit") {
                inp = await Select.prompt<string>({
                    message: "What would you like to do?",
                    options: ["change rate", "set advance", "rename", "exit"],
                });

                if (inp === "change rate") {
                    const newRate = await Number.prompt({
                        message: "New rate?",
                        float: false,
                        min: 0,
                    });
                    updatedProject.rate = newRate;
                } else if (inp === "set advance") {
                    const newAdvance = await Number.prompt({
                        message: "Advance amount (in hours)",
                        float: false,
                        min: 0,
                    });
                    updatedProject.advance = newAdvance;
                } else if (inp === "rename") {
                    const newName = await Input.prompt({ message: "", validate: (s) => s.trim() !== "" });
                    updatedProject.name = newName;
                }

                if (inp !== "exit") {
                    await storage.putProject(updatedProject);
                    await storage.touchProject(id);
                }
            }

            const updated = await storage.getProjectById(id);
            respond(cmd, (data) => {
                console.log(data.message);
            }, {
                message: "Edit complete.",
                project: { name: updated.unwrap().name, slug: updated.unwrap().slug, rate: updated.unwrap().rate },
            });
        },
    });
};

export const edit = new Command("edit").option(
    "-p --project <string>",
    "id of the project to edit. Uses the default if not specified.",
)
    .description("Edit a project.")
    .option("--rate <number>", "New hourly rate.")
    .option("--advance <number>", "New advance amount in hours.")
    .option("--rename <name>", "New project name.")
    .action(action);
