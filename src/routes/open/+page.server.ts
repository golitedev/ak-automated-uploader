import type { Actions, PageServerLoad } from './$types';
import { list, type FileInfo } from '$lib/server/file-browser';
import { error, redirect } from '@sveltejs/kit';
import { basename, dirname, join, normalize, relative, sep } from 'node:path';
import { Temporal } from '@js-temporal/polyfill';
import { uploads } from '$lib/server/uploads';
import {
    MediaPathError,
    VIRTUAL_MEDIA_ROOT,
    normalizeMediaPath,
    validateMediaPath,
} from '$lib/server/media-path';

const sortTable: Record<string, string> = {};

function makeBreadcrumbs(fullPath: string, mediaRoot: string): { name: string, path: string }[] {
    fullPath = normalize(fullPath);
    mediaRoot = normalize(mediaRoot);

    const output: { name: string, path: string }[] = [{
        name: basename(mediaRoot),
        path: mediaRoot,
    }];

    const parts = relative(mediaRoot, fullPath).split(sep).filter(Boolean);
    let builtPath = mediaRoot;
    for (const part of parts) {
        builtPath = join(builtPath, part);
        output.push({ name: part, path: builtPath });
    }

    return output;
}

function sortFiles(files: FileInfo[], sort: string): string {

    switch (sort) {
        case 'name-desc':
            files.sort((a, b) => b.name.localeCompare(a.name));
            break;

        case 'size-asc':
            files.sort((a, b) => (a.size || 0) - (b.size || 0));
            break;

        case 'size-desc':
            files.sort((a, b) => (b.size || 0) - (a.size || 0));
            break;

        case 'modified-asc':
            files.sort((a, b) => {
                const aTime = a.modified ? Temporal.Instant.from(a.modified).epochMilliseconds : 0;
                const bTime = b.modified ? Temporal.Instant.from(b.modified).epochMilliseconds : 0;
                return aTime - bTime;
            });
            break;

        case 'modified-desc':
            files.sort((a, b) => {
                const aTime = a.modified ? Temporal.Instant.from(a.modified).epochMilliseconds : 0;
                const bTime = b.modified ? Temporal.Instant.from(b.modified).epochMilliseconds : 0;
                return bTime - aTime;
            });
            break;

        default: // Fall back to name-asc
            files.sort((a, b) => a.name.localeCompare(b.name));
            sort = 'name-asc';
    }

    return sort;

}

export const load: PageServerLoad = async ({ url, cookies, locals }) => {

    const requestedPath = url.searchParams.get('browse');
    const cookiePath = requestedPath === null ? cookies.get('akauLastBrowsePath') : undefined;
    const rawPath = requestedPath ?? cookiePath ?? VIRTUAL_MEDIA_ROOT;
    let path = VIRTUAL_MEDIA_ROOT;
    let mediaRoot: string | undefined;

    if (rawPath !== VIRTUAL_MEDIA_ROOT && rawPath !== '') {
        let normalizedPath: string | undefined;
        try {
            normalizedPath = normalizeMediaPath(rawPath);
        } catch (caught) {
            // A stale cookie from the old home-directory browser should only
            // return to the virtual root; an explicit request must be rejected.
            if (requestedPath === null && cookiePath) {
                path = VIRTUAL_MEDIA_ROOT;
            } else if (caught instanceof MediaPathError) {
                error(caught.status, caught.message);
            } else {
                error(500, 'Unable to validate the requested media path');
            }
        }

        if (!normalizedPath) {
            // The only non-error path through the validation block is an
            // invalid legacy browse cookie, which intentionally returns home.
        } else if (normalizedPath !== rawPath) {
            url.searchParams.set('browse', normalizedPath);
            redirect(302, url);
        } else {
            try {
                const validated = await validateMediaPath(normalizedPath);
                path = validated.path;
                mediaRoot = validated.root.path;
            } catch (caught) {
                if (requestedPath === null && cookiePath) {
                    path = VIRTUAL_MEDIA_ROOT;
                } else if (caught instanceof MediaPathError) {
                    error(caught.status, caught.message);
                } else {
                    error(500, 'Unable to validate the requested media path');
                }
            }
        }
    }

    let sort = url.searchParams.get('sort') || '';
    if (!sort) {
        const rememberedSort = sortTable[path];
        if (rememberedSort) sort = rememberedSort;
    }
    
    let files: FileInfo[];
    try {
        files = await list(path);
    } catch (caught) {
        if (caught instanceof MediaPathError) error(caught.status, caught.message);
        error(404, `Couldn't browse ${path === VIRTUAL_MEDIA_ROOT ? 'the configured media roots' : path}`);
    }

    const breadcrumbs = mediaRoot ? makeBreadcrumbs(path, mediaRoot) : [];
    const parentPath = path === VIRTUAL_MEDIA_ROOT || path === mediaRoot
        ? VIRTUAL_MEDIA_ROOT
        : dirname(path);

    sort = sortFiles(files, sort);
    sortTable[path] = sort;

    return {
        files,
        path,
        parentPath,
        isVirtualRoot: path === VIRTUAL_MEDIA_ROOT,
        breadcrumbs,
        sort,
        timeZone: locals.timeZone,
        locale: locals.locale,
    };

};

export const actions = {
    default: async ({ request }) => {
        const data = await request.formData();
        const selectedPath = data.get('path');
        if (typeof selectedPath !== 'string' || !selectedPath) {
            throw error(400, 'Missing path');
        }

        let uploadId;
        try {
            uploadId = await uploads.create(selectedPath);
        } catch (caught) {
            if (caught instanceof MediaPathError) error(caught.status, caught.message);
            error(400, 'The selected path is not a valid configured media path');
        }
        throw redirect(303, `/uploads/${uploadId}`);
    }
} satisfies Actions;
