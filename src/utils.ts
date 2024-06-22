import { kv } from "./kv.ts";

export type Maybe<T> = T | undefined;

export const getProject = async (id: Maybe<string>) => {
    let project = id;
    if (!project) {
        const defaultProject = await kv.get<string>(['projects', 'default']);
        if (defaultProject.value) project = defaultProject.value;
    }

    if (!project) {
        throw new Error("No project specified and no default project set.");
    }

    return project;
}