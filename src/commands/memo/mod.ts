import { Command } from "commander";
import { deleteMemo } from "./delete.ts";
import { edit } from "./edit.ts";
import { add } from "./add.ts";
import { Input } from "@cliffy/prompt";

export async function promptForCost(current?: number): Promise<number> {
    while (true) {
        const msg = current === undefined
            ? "Cost of expense? (number)"
            : `New cost (current: ${current}). Leave blank to keep.`;
        const inp = await Input.prompt({ message: msg });
        if (current !== undefined && !inp) return current;
        const cost = Number(inp);
        if (!isNaN(cost)) return cost;
        console.log("Invalid cost. Please enter a valid number.");
    }
}

export const memo = new Command("memo")
    .description(
        "Add, edit, or remove memos from your invoice. Memos are little bits of information that are presented along with the project log.",
    )
    .addCommand(add)
    .addCommand(deleteMemo)
    .addCommand(edit);
