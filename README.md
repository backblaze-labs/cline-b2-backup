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

## FAQ

**How do I get Backblaze B2 credentials?**

Create a free [Backblaze B2](https://blze.ai/storage) account, make a bucket, then create an Application Key. Use the keyID and applicationKey as `B2_KEY_ID` and `B2_APPLICATION_KEY`, and the bucket name as `B2_BUCKET`.

**Is my data encrypted?**

Yes — AES-256-GCM at rest. Set `B2_ENCRYPTION_KEY` to a long random passphrase. If you don't, it falls back to deriving a key from your B2 application key and prints a warning; setting a dedicated key means a leaked bucket credential can't decrypt your backups.

**How often does it back up, and can I change the schedule?**

By default it backs up immediately on start and then daily. Set `B2_SCHEDULE` to `daily`, `weekly`, or any cron expression.

**Does it re-upload everything each time?**

No. Backups are incremental — only files that changed since the last run are uploaded (SHA-256 diffing); unchanged files are carried forward server-side, so each snapshot still restores on its own.

**How do I restore Cline on a new machine?**

Install and run `cline-b2-backup` on the new machine. If local state is empty and snapshots exist in your bucket, it auto-restores the latest snapshot on first run. (You can also point it at a fresh bucket prefix to keep machines separate.)

**How many snapshots are kept?**

The 10 most recent by default; older ones are pruned. Change with `B2_KEEP_SNAPSHOTS`.

**How do I run it automatically in the background?**

`cline-b2-backup --install` writes an OS service (launchd on macOS, systemd user unit on Linux, Task Scheduler on Windows). Because a background service can't see your shell's exported variables, put your credentials in `~/.config/cline-b2-backup/config.json` (chmod 600) before activating it.

**Can I back up several machines to one bucket?**

Yes — give each machine a distinct `B2_PREFIX` so their snapshots don't mix.

**How do I check it's actually working?**

Run `cline-b2-backup --once` and watch the output; it logs what it uploaded and the snapshot id. You can also browse the bucket in the B2 web UI.

**How much does this cost?**

Only your Backblaze B2 storage, which is priced per GB-month — see [blze.ai/storage](https://blze.ai/storage). The tool itself is free and open source (MIT).

**Which editors does it cover?**

It auto-discovers Cline's storage across VS Code, VS Code Insiders, VSCodium, Cursor, and Windsurf (including VS Code profiles), plus the shared `~/.cline/data` directory.

**Why aren't my checkpoints backed up?**

Cline's per-workspace shadow-git `checkpoints/` can reach many gigabytes and is excluded by default to keep backups fast and cheap. Your conversation history and task data are still fully backed up.

**Are my API keys backed up?**

Yes — Cline stores them in `~/.cline/data/secrets.json` (plaintext on disk); the tool includes it but encrypts the whole mirror, so set `B2_ENCRYPTION_KEY`.

**I restored but one editor's history is missing.**

Restore writes into each editor's storage dir, which must already exist. Install and launch that editor (so Cline's dir is created) before restoring — missing editors are skipped with a warning, not an error.

## Learn more

- [Backblaze B2 Cloud Storage](https://blze.ai/storage) — affordable, S3-compatible object storage
- [agent-backup-core](https://github.com/backblaze-labs/agent-backup-core) — the shared backup engine powering this tool

## License

MIT
