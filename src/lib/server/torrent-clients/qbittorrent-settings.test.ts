import { describe, expect, test } from 'bun:test';
import * as v from 'valibot';
import { SettingsSchema, TorrentClientSettingsSchema } from '../../types';
import buildSchemaFromFields from '../util/build-schema-from-fields';
import { settings as qbittorrentSettings } from './qbittorrent';

describe('qBittorrent settings', () => {

    test('retains path mappings through client and app settings validation', () => {

        const pathMappings = '/hdd1=/hdd1\n/hdd2=/hdd2\n/hdd3=/hdd3\n/hdd4=/hdd4';
        const input = {
            name: 'qBittorrent',
            url: 'http://qbittorrent.test',
            username: 'user',
            password: 'password',
            pathMappings,
        };

        const defaultsAdded = v.parse(
            buildSchemaFromFields(qbittorrentSettings, 'qBittorrent'),
            input,
        );
        const validatedClientSettings = v.parse(TorrentClientSettingsSchema, defaultsAdded);
        const validatedAppSettings = v.parse(SettingsSchema, { torrentClient: validatedClientSettings });

        expect(validatedClientSettings.pathMappings).toBe(pathMappings);
        expect(validatedAppSettings.torrentClient?.pathMappings).toBe(pathMappings);

    });

    test('exposes path mappings as a multiline qBittorrent setting', () => {

        expect(qbittorrentSettings.find((field) => field.id === 'pathMappings')).toMatchObject({
            label: 'Path mappings',
            type: 'multiline',
        });

    });

});
