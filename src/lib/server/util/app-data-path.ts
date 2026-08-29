import { lstat, mkdir, readdir, rename, rmdir } from 'node:fs/promises';
import { join, normalize, posix } from 'node:path';
import { env } from 'node:process';
import { log } from './log';

export const DEFAULT_CONFIG_ROOT = '/config';
export const LEGACY_CONFIG_DIRECTORY = 'ak-automated-uploader';
export const APP_TEMP_DIRECTORY = 'tmp';

function normalizedConfigRoot(value: string): string {
    const trimmed = value.trim();
    if (!trimmed || !posix.isAbsolute(trimmed)) {
        throw Error(`AK_CONFIG_DIR must be an absolute path, received "${value}"`);
    }

    const root = normalize(trimmed);
    if (root === '/') {
        throw Error('AK_CONFIG_DIR must not be the filesystem root');
    }

    return root;
}

export function getConfigRoot(environment: NodeJS.ProcessEnv = env): string {
    return normalizedConfigRoot(environment.AK_CONFIG_DIR || DEFAULT_CONFIG_ROOT);
}

export function appTempPath(fileName?: string, root = getConfigRoot()): string {
    const tempRoot = join(root, APP_TEMP_DIRECTORY);
    return fileName ? join(tempRoot, fileName) : tempRoot;
}

async function pathExists(path: string): Promise<boolean> {
    try {
        await lstat(path);
        return true;
    } catch {
        return false;
    }
}

async function migrateLegacyConfig(root: string): Promise<void> {
    const legacyRoot = join(root, LEGACY_CONFIG_DIRECTORY);

    let legacyEntries;
    try {
        const legacyInfo = await lstat(legacyRoot);
        if (!legacyInfo.isDirectory()) {
            log(`Legacy config path ${legacyRoot} is not a directory; leaving it in place`, 'khaki');
            return;
        }
        legacyEntries = await readdir(legacyRoot);
    } catch {
        return;
    }

    for (const name of legacyEntries) {
        const source = join(legacyRoot, name);
        const destination = join(root, name);

        if (await pathExists(destination)) {
            log(`Skipped legacy config ${source}; ${destination} already exists`, 'khaki');
            continue;
        }

        await rename(source, destination);
        log(`Migrated legacy config ${source} to ${destination}`, 'aquamarine');
    }

    try {
        await rmdir(legacyRoot);
        log(`Removed empty legacy config directory ${legacyRoot}`, 'aquamarine');
    } catch {
        // Existing destination files are intentionally left untouched, so the
        // legacy directory can remain when it still contains skipped entries.
    }
}

export async function initializeAppData(root = getConfigRoot()): Promise<string> {
    root = normalizedConfigRoot(root);
    await mkdir(root, { recursive: true });
    await migrateLegacyConfig(root);
    await mkdir(appTempPath(undefined, root), { recursive: true });
    return root;
}

export async function ensureAppTempDirectory(root = getConfigRoot()): Promise<string> {
    await initializeAppData(root);
    return appTempPath(undefined, root);
}

export default async function appDataPath(fileName?: string, root = getConfigRoot()): Promise<string> {
    root = await initializeAppData(root);
    return fileName ? join(root, fileName) : root;
}
