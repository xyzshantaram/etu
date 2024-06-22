import { Command } from "@/commander";
import { start } from "./start.ts";
import { stop } from "./stop.ts";

export const session = new Command("session")
    .description("Edit and manage sessions.")
    .addCommand(start)
    .addCommand(stop);
