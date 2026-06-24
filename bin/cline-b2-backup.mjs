#!/usr/bin/env node
// Thin entry point: all logic lives in @backblaze-labs/agent-backup-core.
// Usage:
//   cline-b2-backup            run as a daemon (auto-restore + back up now + scheduled)
//   cline-b2-backup --once     run a single backup and exit (for cron/CI)
//   cline-b2-backup --install  install an OS service that runs the daemon at login
//   cline-b2-backup --help     show usage
// Config (B2 credentials) comes from env vars or ~/.config/cline-b2-backup/config.json.
import { runCli } from "@backblaze-labs/agent-backup-core";
import { clineAdapter } from "../dist/index.mjs";

runCli(clineAdapter).catch((err) => {
  console.error(`cline-b2-backup: ${err?.message ?? err}`);
  process.exit(1);
});
