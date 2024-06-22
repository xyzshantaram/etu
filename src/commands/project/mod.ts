import { Command } from "@/commander";
import { create } from "./new.ts";
import { setDefault } from "./default.ts";

export const project = new Command('project')
    .description('Create, edit, and manage projects')
    .addCommand(create)
    .addCommand(setDefault);