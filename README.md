# cline-b2-backup

**Encrypted, incremental, off-site backups for your AI coding agent — powered by [Backblaze B2 cloud storage](https://blze.ai/storage).**

Incremental, **encrypted** backup of your [Cline](https://github.com/cline/cline) task history, conversations, and state to [Backblaze B2](https://www.backblaze.com/cloud-storage) — across VS Code, Insiders, VSCodium, Cursor, and Windsurf.

Built on [`@backblaze-labs/agent-backup-core`](https://github.com/backblaze-labs/agent-backup-core).

## Why

Cline auto-saves every task (full conversation, metadata) locally, but its only built-in export is per-task markdown — there's no full backup, sync, or restore, and data-loss reports are common. This mirrors all of it to B2 on a schedule.

## Install & configure

```bash
npm install -g @backblaze-labs/cline-b2-backup
export B2_KEY_ID=004... B2_APPLICATION_KEY=K004... B2_BUCKET=my-cline-backups
export B2_ENCRYPTION_KEY="a long random passphrase"   # important — see Security
```

Or `~/.config/cline-b2-backup/config.json`. Optional: `B2_REGION`, `B2_PREFIX`, `B2_SCHEDULE`, `B2_KEEP_SNAPSHOTS`, `CLINE_DIR`.

## Run

```bash
cline-b2-backup            # daemon: auto-restore on first run, back up now, then on schedule
cline-b2-backup --once     # single backup then exit
cline-b2-backup --install  # install an OS service (launchd / systemd / Task Scheduler)
cline-b2-backup --help     # usage
```

> `--install` runs the daemon as a background service, which can't see your shell's
> `export B2_*` variables — put your credentials in `~/.config/cline-b2-backup/config.json`
> (chmod 600) before activating it.

## What gets backed up

Cline splits its state across two locations; this tool covers both and auto-discovers every editor you have Cline installed in:

- **`~/.cline/data/`** (or `CLINE_DIR`) — `globalState.json`, `secrets.json`, `workspaces/<hash>/`.
- **Each editor's** `…/User/globalStorage/saoudrizwan.claude-dev/` (VS Code, Insiders, VSCodium, Cursor, Windsurf, plus VS Code profiles — discovered automatically) — `state/taskHistory.json` and `tasks/<id>/` conversations.

**Excluded by default:**
- **Checkpoints** (`checkpoints/`) — Cline's per-workspace shadow-git can reach tens of GB; mirroring it offsite is rarely worth the cost. (Your project's real git history is unaffected.)
- Regeneratable caches: `settings/`, `*_models.json`, `mcp_marketplace_catalog.json`.

### Restore note

Restoring writes back into the same editor/profile directories the backup came from. On a fresh machine, an editor whose `globalStorage` directory doesn't exist yet (the editor was never launched, or has a different product/profile name) is **silently skipped** — its data is left in B2, not restored — and the restore logs a per-file warning rather than failing. So before restoring, install and launch each editor (so Cline's storage dir exists). Backup itself has no such requirement.

## Security

- **Set `B2_ENCRYPTION_KEY`** — separate from your B2 credentials. Cline stores provider **API keys in plaintext** at `~/.cline/data/secrets.json`; this tool includes that file (needed for a full restore) but encrypts the whole mirror at rest. Without `B2_ENCRYPTION_KEY` it falls back to the B2 key and warns.

## Learn more

- [Backblaze B2 Cloud Storage](https://blze.ai/storage) — affordable, S3-compatible object storage
- [agent-backup-core](https://github.com/backblaze-labs/agent-backup-core) — the shared backup engine powering this tool

## License

MIT
