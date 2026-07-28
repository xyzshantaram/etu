import { Command } from "commander";
import * as storage from "@/storage.ts";
import { match } from "@/oxide";
import { fail, respond } from "@/utils.ts";

const action = async (id: string, _opts: unknown, cmd: Command) => {
    match(await storage.setDefaultProject(id), {
        Ok: (_) => {
            respond(cmd, (data) => {
                console.log(data.message);
            }, {
                message: `Successfully set default project to \`${id}\`.`,
                project: { slug: id },
            });
        },
        Err: (msg) => fail(cmd, msg),
    });
};

export const setDefault = new Command("default")
    .argument("<id>", "id of the project to set as default.")
    .description("Change the default project.")
    .action(action);
