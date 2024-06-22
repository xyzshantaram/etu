import { Command } from "@/commander";
import { create } from "./new.ts";
import { setDefault } from "./default.ts";
import { list } from "./list.ts";
import { edit } from "./edit.ts";
import { del } from "./delete.ts";

export const project = new Command("project")
    .description("Create, edit, and manage projects")
    .addCommand(create)
    .addCommand(setDefault)
    .addCommand(list)
    .addCommand(edit)
    .addCommand(del);
