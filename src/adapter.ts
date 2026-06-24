import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { BackupAdapter, BackupRoot } from "@backblaze-labs/agent-backup-core";

/**
 * Cline's state is SPLIT across two locations (a migration in progress upstream):
 *   1. `~/.cline/data/` (overridable via `CLINE_DIR`) — globalState.json,
 *      secrets.json (plaintext API keys, mode 0600), workspaces/<hash>/.
 *      Shared across VS Code / CLI / JetBrains.
 *   2. VS Code-family extension globalStorage `<editor>/User/globalStorage/
 *      saoudrizwan.claude-dev/` — state/taskHistory.json, tasks/<id>/, and
 *      checkpoints/ (a per-workspace shadow git repo, which can be many GB).
 *
 * Editors are VS Code forks that all install the same extension id, so only the
 * product directory differs (Code, Code - Insiders, VSCodium, Cursor, Windsurf,
 * …). We DISCOVER them by globbing the product dir rather than hardcoding names,
 * and also scan VS Code profile subdirs.
 *
 * Verified against github.com/cline/cline (core/storage/disk.ts,
 * hosts/vscode/vscode-to-file-migration.ts, shared/storage/storage-context.ts,
 * integrations/checkpoints/CheckpointUtils.ts).
 */
const CLINE_EXT_ID = "saoudrizwan.claude-dev";

/** Base dirs that contain VS Code-family product directories, per platform. */
function editorBaseDirs(env: NodeJS.ProcessEnv): string[] {
  const home = os.homedir();
  if (process.platform === "darwin") return [path.join(home, "Library", "Application Support")];
  if (process.platform === "win32") {
    return [env.APPDATA ?? path.join(home, "AppData", "Roaming")];
  }
  return [env.XDG_CONFIG_HOME || path.join(home, ".config")];
}

function listDirs(dir: string): string[] {
  try {
    return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

/** Filesystem/regex-safe label segment from a product dir name ("Code - Insiders" → "Code-Insiders"). */
function sanitize(name: string): string {
  return name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function isDir(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Discover every Cline globalStorage dir across installed editors (default and
 * profile-scoped). Each becomes a root labeled `gs-<product>[-<profile>]`.
 */
export function clineGlobalStorageRoots(
  env: NodeJS.ProcessEnv,
  baseDirs: string[] = editorBaseDirs(env),
): BackupRoot[] {
  const roots: BackupRoot[] = [];
  // `__` separates product from profile so a default install of product
  // "Code - Insiders" (→ gs-Code-Insiders) can't collide with product "Code" +
  // profile "Insiders" (→ gs-Code__Insiders). A final uniqueness pass below
  // disambiguates any residual collision deterministically.
  for (const base of baseDirs) {
    for (const product of listDirs(base)) {
      const userDir = path.join(base, product, "User");
      const def = path.join(userDir, "globalStorage", CLINE_EXT_ID);
      if (isDir(def)) roots.push({ label: `gs-${sanitize(product)}`, dir: def });
      const profilesDir = path.join(userDir, "profiles");
      for (const profile of listDirs(profilesDir)) {
        const pdir = path.join(profilesDir, profile, "globalStorage", CLINE_EXT_ID);
        if (isDir(pdir)) roots.push({ label: `gs-${sanitize(product)}__${sanitize(profile)}`, dir: pdir });
      }
    }
  }
  return disambiguateLabels(roots);
}

/** Ensure labels are unique; on collision append a stable -2, -3, … in discovery order. */
function disambiguateLabels(roots: BackupRoot[]): BackupRoot[] {
  const counts = new Map<string, number>();
  return roots.map((r) => {
    const n = (counts.get(r.label) ?? 0) + 1;
    counts.set(r.label, n);
    return n === 1 ? r : { ...r, label: `${r.label}-${n}` };
  });
}

/** All candidate roots: the shared `~/.cline/data` plus discovered globalStorage dirs. */
export function clineCandidateRoots(env: NodeJS.ProcessEnv): BackupRoot[] {
  const clineDir = env.CLINE_DIR || path.join(os.homedir(), ".cline");
  return [{ label: "cline-data", dir: path.join(clineDir, "data") }, ...clineGlobalStorageRoots(env)];
}

export const clineAdapter: BackupAdapter = {
  id: "cline",

  resolveRoots(env) {
    return clineCandidateRoots(env).filter((r) => isDir(r.dir));
  },

  include: [
    // Shared data dir (cross-IDE).
    /^cline-data\/globalState\.json$/,
    /^cline-data\/secrets\.json$/, // plaintext API keys — included (encrypted) by policy
    /^cline-data\/workspaces\//,
    // Per-editor task history + conversations.
    /^gs-[^/]*\/state\/taskHistory\.json$/,
    /^gs-[^/]*\/tasks\//,
  ],

  exclude: [
    // Shadow-git checkpoints can be many GB — excluded by default.
    /^gs-[^/]*\/checkpoints\//,
    // Regeneratable caches/catalogs.
    /^gs-[^/]*\/settings\//,
    /_models\.json$/,
    /mcp_marketplace_catalog\.json$/,
    /(^|\/)cache\//,
    /(^|\/)\.cache\//,
    /(^|\/)\.DS_Store$/,
    /\.tmp$/,
    /\.lock$/,
  ],

  // Cline persists everything as JSON files — no SQLite.
  sqlite: [],

  // secrets.json is a discrete file, but the chosen policy is an encrypted full
  // mirror that includes secrets (needed for a working restore), so we don't
  // exclude it — the engine encrypts it at rest.
  secretExclude: [],
};
