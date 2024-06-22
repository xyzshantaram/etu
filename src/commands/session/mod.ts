import { Command } from "@/commander";
import { start } from "./start.ts";
import { stop } from "./stop.ts";
import { Session } from "../../utils.ts";
import * as storage from '../../storage.ts';
import { deleteSession } from "./delete.ts";


export const getSessionChoices = async (id: string) => {
    const choices: string[] = [];
    const map: Record<string, Session> = {};
    for await (const session of storage.getSessions(id)) {
        const key = session.key[3].toString();
        choices.push(key);
        map[key] = session.value;
    }
    return { choices, map };
}

export const session = new Command("session")
    .description("Edit and manage sessions.")
    .addCommand(start)
    .addCommand(stop)
    .addCommand(deleteSession);
