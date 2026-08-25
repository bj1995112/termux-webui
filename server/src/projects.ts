import fs from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import type { ProjectInfo } from '@termux-webui/shared';

const SCAN_ROOTS = [
  path.join(homedir(), '项目'),
  path.join(homedir(), 'projects'),
  path.join(homedir(), 'code'),
  homedir(),
];

/** One-level scan of common workspace roots. A directory counts as a project
 * when it looks like one (git repo, package.json, or just a workspace folder
 * the user created). Hidden dirs and system junk are skipped. */
export function listProjects(): ProjectInfo[] {
  const seen = new Set<string>();
  const out: ProjectInfo[] = [];
  for (const root of SCAN_ROOTS) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith('.') || e.name === 'node_modules') continue;
      const full = path.join(root, e.name);
      const key = full.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ name: e.name, path: full });
    }
  }
  return out.slice(0, 50);
}
