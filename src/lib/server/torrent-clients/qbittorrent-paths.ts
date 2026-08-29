import posixPath from 'node:path/posix';

interface PathModule {
    sep: string;
    normalize(path: string): string;
    isAbsolute(path: string): boolean;
    parse(path: string): { root: string };
}

export interface QbittorrentPathMapping {
    source: string;
    destination: string;
}

function normalizePath(value: string, pathModule: PathModule) {

    const normalized = pathModule.normalize(value);
    const root = pathModule.parse(normalized).root;
    let withoutTrailingSeparators = normalized;

    while (withoutTrailingSeparators.length > root.length && withoutTrailingSeparators.endsWith(pathModule.sep)) {
        withoutTrailingSeparators = withoutTrailingSeparators.slice(0, -pathModule.sep.length);
    }

    return withoutTrailingSeparators;

}

function normalizeMappingPath(value: string, lineNumber: number, side: string, pathModule: PathModule) {

    const trimmed = value.trim();
    if (!trimmed || !pathModule.isAbsolute(trimmed)) {
        throw Error(`qBittorrent path mapping on line ${lineNumber} must use an absolute ${side} path`);
    }

    return normalizePath(trimmed, pathModule);

}

export function parseQbittorrentPathMappings(mappingText: string, pathModule: PathModule = posixPath): QbittorrentPathMapping[] {

    const mappings: QbittorrentPathMapping[] = [];

    for (const [index, line] of mappingText.split(/\r?\n/).entries()) {

        const lineNumber = index + 1;
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        const separatorIndex = trimmedLine.indexOf('=');
        if (separatorIndex < 0) {
            throw Error(`Invalid qBittorrent path mapping on line ${lineNumber}; use /source/path=/destination/path`);
        }

        const source = normalizeMappingPath(trimmedLine.slice(0, separatorIndex), lineNumber, 'source', pathModule);
        const destination = normalizeMappingPath(trimmedLine.slice(separatorIndex + 1), lineNumber, 'destination', pathModule);
        mappings.push({ source, destination });

    }

    return mappings;

}

function matchesPath(path: string, source: string, pathModule: PathModule) {

    const root = pathModule.parse(source).root;
    return source === root
        ? path.startsWith(root)
        : path === source || path.startsWith(`${source}${pathModule.sep}`);

}

function appendRemainder(destination: string, remainder: string, pathModule: PathModule) {

    if (!remainder) return destination;

    const separator = pathModule.sep;
    if (destination.endsWith(separator)) {
        return destination + (remainder.startsWith(separator) ? remainder.slice(separator.length) : remainder);
    }

    return destination + (remainder.startsWith(separator) ? remainder : separator + remainder);

}

export function mapQbittorrentPath(contentPath: string, mappingText: string, pathModule: PathModule = posixPath): string | undefined {

    const mappings = parseQbittorrentPathMappings(mappingText, pathModule);
    if (mappings.length === 0) return undefined;

    const normalizedContentPath = normalizePath(contentPath, pathModule);
    let matchingMapping: QbittorrentPathMapping | undefined;

    for (const mapping of mappings) {
        if (!matchesPath(normalizedContentPath, mapping.source, pathModule)) continue;
        if (!matchingMapping || mapping.source.length > matchingMapping.source.length) matchingMapping = mapping;
    }

    if (!matchingMapping) {
        throw Error(`Content path "${normalizedContentPath}" isn't covered by a qBittorrent path mapping`);
    }

    const remainder = normalizedContentPath.slice(matchingMapping.source.length);
    return appendRemainder(matchingMapping.destination, remainder, pathModule);

}
