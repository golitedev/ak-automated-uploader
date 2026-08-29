import { Temporal } from '@js-temporal/polyfill';
import { file } from 'bun';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pauseHashing, resumeHashing } from './torrent';
import {
    VIRTUAL_MEDIA_ROOT,
    getMediaRoots,
    validateMediaDirectory,
    validateMediaPath,
    type MediaRoot,
} from './media-path';

export interface FileInfo {
    name: string;
    path: string;
    isDir: boolean;
    size?: number;
    modified?: string;
}

async function getItem(name: string, path: string, roots: MediaRoot[]): Promise<FileInfo | null> {

    let fileInfo;
    try {
        const validated = await validateMediaPath(path, roots);
        fileInfo = await file(validated.path).stat();
    } catch {
        return null;
    }

    const isDir = fileInfo.isDirectory();

    if (isDir) {

        const dir: FileInfo = {
            name,
            path,
            isDir,
        };

        if (fileInfo.size) {
            dir.size = fileInfo.size;
        }

        if (fileInfo.mtimeMs) {
            dir.modified = Temporal.Instant.fromEpochMilliseconds(Math.round(fileInfo.mtimeMs)).toString();
        }

        return dir;

    } else {

        return {
            name,
            path,
            isDir,
            size: fileInfo.size,
            modified: Temporal.Instant.fromEpochMilliseconds(Math.round(fileInfo.mtimeMs)).toString(),
        };

    }
}

export async function list(requestedPath: string, roots?: MediaRoot[]): Promise<FileInfo[]> {

    try {

        pauseHashing();

        const mediaRoots = roots ?? await getMediaRoots();

        if (requestedPath === VIRTUAL_MEDIA_ROOT) {
            const promises = mediaRoots.map(root => getItem(root.name, root.path, mediaRoots));
            const rootEntries = await Promise.all(promises);
            return rootEntries.filter(file => file !== null);
        }

        const validated = await validateMediaDirectory(requestedPath, mediaRoots);
        const paths = await readdir(validated.path);
        const promises = [];

        for (const name of paths) {

            const path = join(validated.path, name);

            promises.push(getItem(name, path, mediaRoots));

        }

        const output = await Promise.all(promises);

        return output.filter(file => file !== null);

    } finally {
        resumeHashing();
    }

}
