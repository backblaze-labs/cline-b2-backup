import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { shouldInclude } from "@backblaze-labs/agent-backup-core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clineAdapter, clineCandidateRoots, clineGlobalStorageRoots } from "./adapter.js";

const EXT = "saoudrizwan.claude-dev";

describe("clineCandidateRoots", () => {
  it("includes ~/.cline/data by default and honors CLINE_DIR", () => {
    expect(clineCandidateRoots({} as NodeJS.ProcessEnv)[0]).toEqual({
      label: "cline-data",
      dir: path.join(os.homedir(), ".cline", "data"),
    });
    expect(clineCandidateRoots({ CLINE_DIR: "/custom/cline" } as NodeJS.ProcessEnv)[0].dir).toBe(
      path.join("/custom/cline", "data"),
    );
  });
});

describe("clineGlobalStorageRoots discovery", () => {
  let base: string;
  beforeEach(async () => {
    base = await fs.promises.mkdtemp(path.join(os.tmpdir(), "cline-editors-"));
    // Two editors with Cline installed + one VS Code profile; one editor WITHOUT Cline.
    await fs.promises.mkdir(path.join(base, "Code", "User", "globalStorage", EXT), { recursive: true });
    await fs.promises.mkdir(
      path.join(base, "Code - Insiders", "User", "globalStorage", EXT),
      { recursive: true },
    );
    await fs.promises.mkdir(
      path.join(base, "Code", "User", "profiles", "work", "globalStorage", EXT),
      { recursive: true },
    );
    await fs.promises.mkdir(path.join(base, "SomeEditor", "User", "globalStorage", "other.ext"), {
      recursive: true,
    });
  });
  afterEach(async () => {
    await fs.promises.rm(base, { recursive: true, force: true });
  });

  it("finds every editor + profile with Cline, with sanitized labels, and ignores others", () => {
    const roots = clineGlobalStorageRoots({} as NodeJS.ProcessEnv, [base]);
    const labels = roots.map((r) => r.label).sort();
    // Profile uses a `__` separator so it can't collide with a product name.
    expect(labels).toEqual(["gs-Code", "gs-Code-Insiders", "gs-Code__work"]);
    expect(labels.some((l) => l.includes("SomeEditor"))).toBe(false);
  });

  it("never collides a product name with a product+profile pair", async () => {
    // Product "Code" + profile "Insiders" must NOT share a label with the
    // separate product "Code - Insiders" — both could exist on one machine.
    await fs.promises.mkdir(
      path.join(base, "Code", "User", "profiles", "Insiders", "globalStorage", EXT),
      { recursive: true },
    );
    const roots = clineGlobalStorageRoots({} as NodeJS.ProcessEnv, [base]);
    const labels = roots.map((r) => r.label);
    expect(new Set(labels).size).toBe(labels.length); // all unique
    expect(labels).toContain("gs-Code__Insiders"); // product Code + profile Insiders
    expect(labels).toContain("gs-Code-Insiders"); // product "Code - Insiders"
  });
});

describe("clineAdapter include/exclude patterns", () => {
  const patterns = {
    include: clineAdapter.include,
    exclude: clineAdapter.exclude,
    secretExclude: clineAdapter.secretExclude,
  };

  it("includes task history, conversations, shared state, and secrets (encrypted by policy)", () => {
    for (const p of [
      "gs-Code/state/taskHistory.json",
      "gs-Code/tasks/abc/api_conversation_history.json",
      "gs-Code-Insiders/tasks/xyz/ui_messages.json",
      "cline-data/globalState.json",
      "cline-data/secrets.json",
      "cline-data/workspaces/deadbeef/workspaceState.json",
    ]) {
      expect(shouldInclude(p, patterns)).toBe(true);
    }
  });

  it("excludes multi-GB checkpoints and regeneratable caches/catalogs", () => {
    for (const p of [
      "gs-Code/checkpoints/abcd/.git/objects/pack/x.pack",
      "gs-Code/settings/cline_mcp_settings.json",
      "gs-Code/openrouter_models.json",
      "gs-Code/mcp_marketplace_catalog.json",
    ]) {
      expect(shouldInclude(p, patterns)).toBe(false);
    }
  });
});
