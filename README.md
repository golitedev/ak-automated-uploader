# ak-automated-uploader

AK Automated Uploader is a web-based torrent uploader tool for private trackers.

Well, a few private trackers. More coming. Probably.

Upload files by picking them via the web UI, or go fully automated with the API.

![Screenshot of the AK Automated Uploader user interface](https://files.catbox.moe/i32l9r.png)

Supported trackers:

| Tracker         | Features |
| --------------- | -------- |
| Aither          | Duplicate search, banned groups, season pack trumping, repack trumping |
| BeyondHD\*      | Duplicate search, banned groups |
| LST             | Duplicate search, banned groups, season pack trumping, repack trumping |
| MidnightScene\* | Untested |
| Seedpool\*      | Untested |

\* These ones probably work but could use a little testing.

Supported image hosts:
- Catbox
- Freeimage.host
- ImgBB
- imgbox
- PiXhost
- ptpimg
- Zipline (untested)

Supported torrent clients:
- qBittorrent
- rTorrent (experimental)
- Just saving the .torrent file to a folder

## Docker deployment

The prebuilt Linux Docker image is the supported deployment method. No Bun,
ffmpeg, or mkbrr installation is needed on the host:

`ghcr.io/golitedev/ak-automated-uploader:latest`

AK uses a Docker-first filesystem model:

- `/config` is the only persistent application-data directory. Settings,
  tokens, and other AK state are stored directly below it.
- `/config/tmp` is the only location for AK-generated temporary files.
- Media is available only through the directories listed in
  `AK_MEDIA_ROOTS`; the recommended deployment mounts those directories
  read-only.
- The file browser starts at a virtual list of those media roots. It never
  exposes the container filesystem root or a home directory.
- An old `/config/ak-automated-uploader` directory is migrated automatically
  when its destination entries do not already exist. Existing files are never
  overwritten.

Create the host config directory and make it writable by the container user
(UID 1001; the example Compose file uses GID 10), then start AK:

```
mkdir -p /volume2/docker/ak-automated-uploader/config
docker compose up -d
```

Edit `ORIGIN` in `docker-compose.yml` to the URL users use to access AK. The
container image already supplies the default port; `AK_MEDIA_ROOTS` and the
four read-only media mounts must match.

The complete recommended Compose configuration is in
[`docker-compose.yml`](docker-compose.yml). It uses a read-only container
root filesystem, drops all Linux capabilities, and enables
`no-new-privileges`. The `/config` bind mount remains writable, while the
media mounts remain read-only.

The optional Content folder setting must also be inside one of the configured
media roots. It cannot be used to browse or open arbitrary container paths.

### qBittorrent path mappings

The qBittorrent **Path mappings** setting maps paths visible inside AK to paths visible inside qBittorrent. Add one absolute mapping per line using `/ak/path=/qb/path`. When both containers use the same paths, enter:

```
/hdd1=/hdd1
/hdd2=/hdd2
/hdd3=/hdd3
/hdd4=/hdd4
```

When mappings are configured, AK sends the mapped parent directory as qBittorrent's save path and disables Auto TMM for that torrent. qBittorrent's global save path is not used for mapped paths. Leave the setting empty to retain the normal qBittorrent save-path behavior.

For a multi-drive NAS setup, mount each drive at the same path in both
containers. qBittorrent can use read-write mounts while AK only needs
read-only access:

```
services:
  qbittorrent:
    volumes:
      - /volume1/hdd1:/hdd1
      - /volume3/hdd2:/hdd2
      - /volume4/hdd3:/hdd3
      - /volume5/hdd4:/hdd4

  ak-automated-uploader:
    volumes:
      - /volume1/hdd1:/hdd1:ro
      - /volume3/hdd2:/hdd2:ro
      - /volume4/hdd3:/hdd3:ro
      - /volume5/hdd4:/hdd4:ro

    environment:
      AK_MEDIA_ROOTS: /hdd1,/hdd2,/hdd3,/hdd4
```

With these mounts, use the four identity mappings above. For different container paths, map the AK path on the left to the qBittorrent path on the right.

Pushing to `main` runs the GitHub Actions Docker workflow and publishes the
updated image to GitHub Container Registry.

## Known issues

- Needs a pretty clean scene or P2P filename to work because the checker for
  data in the filename is a whitelist.
- No support for full discs yet.
