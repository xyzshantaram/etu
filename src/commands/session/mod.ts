import { Command } from "@/commander";
import { start } from "./start.ts";
import { stop } from "./stop.ts";
import * as storage from '../../storage.ts';
import { deleteSession } from "./delete.ts";
import { Session, sessionName } from "../../utils.ts";
import { edit } from "./edit.ts";


export const getSessionChoices = async (id: string) => {
    const choices: string[] = [];
    const map: Record<string, { obj: Session, ulid: string }> = {};
    for await (const session of storage.getSessions(id)) {
        const s = session.value;
        const fmt = (v: number) => new Date(v).toLocaleString();
        const choice = `Session ${sessionName(s.name)} from ${fmt(s.start)}${s.end ? ' to ' + fmt(s.end) : ''}`;
        choices.push(choice);
        const ulid = session.key[3].toString();
        map[choice] = map[ulid] = { ulid, obj: s };
    }
    return { choices, map };
}

export const session = new Command("session")
    .description("Edit and manage sessions.")
    .addCommand(start)
    .addCommand(stop)
    .addCommand(deleteSession)
    .addCommand(edit);
