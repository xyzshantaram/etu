import { Command } from "@/commander";
import { match } from "@/oxide";
import { getProjectId, scream } from "../../utils.ts";
import { getSessionChoices } from "./mod.ts";
import { Input, Select } from "@/cliffy/prompt";
import * as storage from "../../storage.ts";

interface EEditSessionOpts {
    project: string;
}

const action = async ({ project }: EEditSessionOpts) => {
    return await match(await getProjectId(project), {
        Err: (msg: string) => scream(msg),
        Ok: async (id: string) => {
            const { choices, map } = await getSessionChoices(id);
            const toEdit = await Select.prompt({
                transform: (v) => map[v].ulid,
                message: "Which session do you want to edit?",
                options: choices,
            });

            console.log("Current values:");
            console.log(map[toEdit].obj);

            let inp = "";
            while (inp != "exit") {

                inp = await Select.prompt({
                    message: "What would you like to do?",
                    options: ["change start time", "change end time", "rename", "exit"],
                });

                const acceptTime = async () => {
                    const s = await Input.prompt({
                        message: "What should I set the time to? (yyyy-mm-dd hh:mm:ss)",
                        validate: (s) => /\d\d\d\d-\d\d-\d\d \d\d:\d\d:\d\d/.test(s),
                    });

                    return new Date(s).valueOf();
                };

                switch (inp) {
                    case "change start time": {
                        const start = await acceptTime();
                        await storage.editSession(id, toEdit, { ...map[toEdit].obj, start });
                        break;
                    }
                    case "change end time": {
                        const end = await acceptTime();
                        await storage.editSession(id, toEdit, { ...map[toEdit].obj, end });
                        break;
                    }
                    case "rename": {
                        const name = await Input.prompt("What should the new name be?");
                        await storage.editSession(id, toEdit, { ...map[toEdit].obj, name });
                        break;
                    }
                    default:
                        break;
                }
            }
        },
    });
};

export const edit = new Command("edit")
    .option("-p --project", "id of the project to edit. uses default project if not specified.")
    .description("Edit a session of a project.")
    .action(action);
