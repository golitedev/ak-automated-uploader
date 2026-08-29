import { describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import {
    VIRTUAL_MEDIA_ROOT,
    type MediaRoot,
    normalizeMediaPath,
    parseMediaRootPaths,
    validateMediaPath,
} from './media-path';
import { list } from './file-browser';

async function makeRoot(prefix: string): Promise<MediaRoot> {
    const path = await mkdtemp(join('/tmp', prefix));
    return { path, realPath: await realpath(path), name: basename(path) };
}

describe('AK media path sandbox', () => {

    test('normalizes and deduplicates configured roots', () => {
        expect(parseMediaRootPaths(' /hdd1, /hdd2/., /hdd1/ ')).toEqual(['/hdd1', '/hdd2']);
    });

    test('exposes only configured roots at the virtual browser root', async () => {
        const first = await makeRoot('ak-media-root-');
        const second = await makeRoot('ak-media-root-');
        try {
            const entries = await list(VIRTUAL_MEDIA_ROOT, [first, second]);
            expect(entries.map(entry => entry.path)).toEqual([first.path, second.path]);
            expect(entries.every(entry => entry.isDir)).toBe(true);
        } finally {
            await rm(first.path, { recursive: true, force: true });
            await rm(second.path, { recursive: true, force: true });
        }
    });

    test('browses a configured root and its descendants', async () => {
        const root = await makeRoot('ak-media-browse-');
        try {
            await mkdir(join(root.path, 'tv'));
            await writeFile(join(root.path, 'movie.mkv'), 'media');

            const rootEntries = await list(root.path, [root]);
            expect(rootEntries.map(entry => entry.name).sort()).toEqual(['movie.mkv', 'tv']);
            expect(await list(join(root.path, 'tv'), [root])).toEqual([]);
        } finally {
            await rm(root.path, { recursive: true, force: true });
        }
    });

    test('rejects system paths, the real root, traversal, and sibling prefixes', async () => {
        const root = { path: '/hdd1', realPath: '/hdd1', name: 'hdd1' };
        for (const path of ['/', '/etc', '/config', '/hdd1/../../etc', '/hdd10/foo']) {
            await expect(validateMediaPath(path, [root])).rejects.toThrow();
        }
        expect(() => normalizeMediaPath('/hdd1/../etc')).toThrow('parent-directory traversal');
    });

    test('rejects symlinks that escape the configured media root', async () => {
        const root = await makeRoot('ak-media-symlink-');
        const outside = await mkdtemp(join('/tmp', 'ak-media-outside-'));
        try {
            await writeFile(join(outside, 'secret.txt'), 'secret');
            await symlink(outside, join(root.path, 'escape'));

            await expect(validateMediaPath(join(root.path, 'escape', 'secret.txt'), [root]))
                .rejects.toThrow('outside its configured media root');

            const entries = await list(root.path, [root]);
            expect(entries.some(entry => entry.name === 'escape')).toBe(false);
        } finally {
            await rm(root.path, { recursive: true, force: true });
            await rm(outside, { recursive: true, force: true });
        }
    });

});
