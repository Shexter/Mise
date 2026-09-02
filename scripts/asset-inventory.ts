/**
 * The illustration to-do list, computed rather than maintained.
 *
 *   npx tsx scripts/asset-inventory.ts          # human summary
 *   npx tsx scripts/asset-inventory.ts --json   # machine-readable
 *   npx tsx scripts/asset-inventory.ts --todo   # just the missing ids, one per line
 *
 * A hand-written queue file would drift from the catalogue the day someone adds
 * an ingredient. Status here is derived from three things that must already
 * agree for the app to build: the file on disk, its manifest entry, and its
 * `require()` in the registry. An asset is DONE only when all three hold — for
 * every set, not just ingredients.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolvePath(__dirname, '..');

export type SetName = 'ingredient' | 'appliance' | 'state' | 'onboarding' | 'technique' | 'action';

export const SET_NAMES: readonly SetName[] = [
  'ingredient',
  'appliance',
  'state',
  'onboarding',
  'technique',
  'action',
];

/**
 * Where each set's three facts live.
 *
 * Ingredients keep `assets/food/manifest.json`, whose entries are keyed by
 * canonical ingredient id and carry a required `FoodClass`. The other four sets
 * share `assets/illustrations/manifest.json`, keyed `<set>/<id>` because the id
 * spaces overlap — `blender` is an appliance and a plausible technique subject.
 * Widening the food schema to make `category` optional would have weakened the
 * one check that actually protects tier 3.
 */
export interface SetTarget {
  /** Directory the promoted file lands in, relative to the repo root. */
  assetDir: string;
  /** Manifest that records its provenance, relative to the repo root. */
  manifest: string;
  /** Module holding the generated `require()` block. */
  registryFile: string;
  /** The exported const inside that module. */
  registryConst: string;
  /** How the manifest keys an id from this set. */
  manifestKey: (id: string) => string;
  /** Path a registry literal points at, relative to `src/media/`. */
  requirePath: (id: string) => string;
}

export const SET_TARGETS: Record<SetName, SetTarget> = {
  ingredient: {
    assetDir: 'assets/food',
    manifest: 'assets/food/manifest.json',
    registryFile: 'src/media/foodVisuals.ts',
    registryConst: 'CURATED_FOOD_ILLUSTRATIONS',
    manifestKey: (id) => id,
    requirePath: (id) => `../../assets/food/${id}.webp`,
  },
  appliance: {
    assetDir: 'assets/illustrations/appliance',
    manifest: 'assets/illustrations/manifest.json',
    registryFile: 'src/media/onboardingIllustrations.ts',
    registryConst: 'APPLIANCE_ILLUSTRATIONS',
    manifestKey: (id) => `appliance/${id}`,
    requirePath: (id) => `../../assets/illustrations/appliance/${id}.webp`,
  },
  onboarding: {
    assetDir: 'assets/illustrations/onboarding',
    manifest: 'assets/illustrations/manifest.json',
    registryFile: 'src/media/onboardingIllustrations.ts',
    registryConst: 'GOAL_ILLUSTRATIONS',
    manifestKey: (id) => `onboarding/${id}`,
    requirePath: (id) => `../../assets/illustrations/onboarding/${id}.webp`,
  },
  state: {
    assetDir: 'assets/illustrations/state',
    manifest: 'assets/illustrations/manifest.json',
    registryFile: 'src/media/stateIllustrations.ts',
    registryConst: 'STATE_ILLUSTRATIONS',
    manifestKey: (id) => `state/${id}`,
    requirePath: (id) => `../../assets/illustrations/state/${id}.webp`,
  },
  technique: {
    assetDir: 'assets/illustrations/technique',
    manifest: 'assets/illustrations/manifest.json',
    registryFile: 'src/media/techniqueIllustrations.ts',
    registryConst: 'TECHNIQUE_ILLUSTRATIONS',
    manifestKey: (id) => `technique/${id}`,
    requirePath: (id) => `../../assets/illustrations/technique/${id}.webp`,
  },
  action: {
    assetDir: 'assets/illustrations/action',
    manifest: 'assets/illustrations/manifest.json',
    registryFile: 'src/media/actionIllustrations.ts',
    registryConst: 'ACTION_ILLUSTRATIONS',
    manifestKey: (id) => `action/${id}`,
    requirePath: (id) => `../../assets/illustrations/action/${id}.webp`,
  },
};

interface CanonicalItem {
  id: string;
  displayName: string;
  class: string;
}

export interface Slot {
  id: string;
  set: SetName;
  label: string;
  /** What the prompt should depict. */
  subject: string;
  /** Empty when nothing blocks generation. */
  blockedBy: string | null;
  status: 'done' | 'partial' | 'missing';
  /** Which of the three requirements are already satisfied. */
  has: { file: boolean; manifest: boolean; registry: boolean };
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

/**
 * A registry is a hand-maintained block of static `require()` calls — Metro
 * cannot bundle a dynamic path — so it is read as text. Importing the module
 * would execute those requires against .webp files outside a bundler.
 */
export function registryIds(set: SetName): Set<string> {
  const target = SET_TARGETS[set];
  const path = resolvePath(ROOT, target.registryFile);
  if (!existsSync(path)) return new Set();
  const source = readFileSync(path, 'utf8');
  const block = new RegExp(`${target.registryConst}[^=]*=\\s*\\{([\\s\\S]*?)\\n\\};`).exec(source);
  if (!block?.[1]) return new Set();
  return new Set([...block[1].matchAll(/["']([a-z0-9][a-z0-9_-]*)["']\s*:/g)].map((m) => m[1]!));
}

function filesOnDisk(set: SetName): Set<string> {
  const dir = resolvePath(ROOT, SET_TARGETS[set].assetDir);
  if (!existsSync(dir)) return new Set();
  return new Set(
    readdirSync(dir)
      .filter((f) => /\.(png|webp)$/.test(f))
      .map((f) => f.replace(/\.(png|webp)$/, '')),
  );
}

function manifestIds(set: SetName): Set<string> {
  const path = resolvePath(ROOT, SET_TARGETS[set].manifest);
  if (!existsSync(path)) return new Set();
  const manifest = readJson<{ assets: Record<string, unknown> }>(path);
  const prefix = SET_TARGETS[set].manifestKey('');
  return new Set(
    Object.keys(manifest.assets)
      .filter((key) => key.startsWith(prefix))
      .map((key) => key.slice(prefix.length)),
  );
}

export function inventory(): Slot[] {
  const briefs = readJson<any>(resolvePath(ROOT, 'assets/illustration-briefs.json'));
  const items = readJson<CanonicalItem[]>(resolvePath(ROOT, 'assets/canonical-items.json'));

  const slots: Slot[] = [];

  const ingredientFiles = filesOnDisk('ingredient');
  const ingredientManifest = manifestIds('ingredient');
  const ingredientRegistry = registryIds('ingredient');

  for (const item of items) {
    const has = {
      file: ingredientFiles.has(item.id),
      manifest: ingredientManifest.has(item.id),
      registry: ingredientRegistry.has(item.id),
    };
    const done = has.file && has.manifest && has.registry;
    const any = has.file || has.manifest || has.registry;
    const customSubject =
      briefs.sets?.ingredient?.subjects?.[item.id] ?? briefs.ingredientSubjects?.[item.id];
    const subject = customSubject ?? item.displayName.toLowerCase();
    slots.push({
      id: item.id,
      set: 'ingredient',
      label: item.displayName,
      subject,
      blockedBy: null,
      status: done ? 'done' : any ? 'partial' : 'missing',
      has,
    });
  }

  for (const setName of ['appliance', 'state', 'onboarding', 'technique', 'action'] as const) {
    const set = briefs.sets[setName];
    const files = filesOnDisk(setName);
    const manifest = manifestIds(setName);
    const registry = registryIds(setName);
    for (const [id, subject] of Object.entries(set.subjects as Record<string, string>)) {
      const has = {
        file: files.has(id),
        manifest: manifest.has(id),
        registry: registry.has(id),
      };
      const done = has.file && has.manifest && has.registry;
      const any = has.file || has.manifest || has.registry;
      slots.push({
        id,
        set: setName,
        label: id,
        subject,
        blockedBy: set.consumerWired ? null : `${set.blockedBy} (${set.consumer})`,
        status: done ? 'done' : any ? 'partial' : 'missing',
        has,
      });
    }
  }

  return slots;
}

function main(): void {
  const args = process.argv.slice(2);
  const slots = inventory();

  if (args.includes('--json')) {
    console.log(JSON.stringify(slots, null, 2));
    return;
  }

  const ready = slots.filter((s) => s.status !== 'done' && !s.blockedBy);
  if (args.includes('--todo')) {
    for (const slot of ready) console.log(slot.id);
    return;
  }

  const bySet = (name: SetName) => slots.filter((s) => s.set === name);
  const done = slots.filter((s) => s.status === 'done');
  const partial = slots.filter((s) => s.status === 'partial');
  const blocked = slots.filter((s) => s.blockedBy);

  console.log('Mise illustration inventory\n');
  console.log(`  shipped         ${done.length}`);
  console.log(`  ready to make   ${ready.length}`);
  console.log(`  blocked on UI   ${blocked.length}`);
  if (partial.length) {
    console.log(`  INCONSISTENT    ${partial.length}  (file/manifest/registry disagree)`);
  }

  console.log('\nBy set');
  for (const name of SET_NAMES) {
    const all = bySet(name);
    const shipped = all.filter((s) => s.status === 'done').length;
    const block = all.find((s) => s.blockedBy);
    console.log(
      `  ${name.padEnd(11)} ${String(shipped).padStart(3)}/${String(all.length).padEnd(4)}` +
        (block ? '  BLOCKED' : ''),
    );
  }

  for (const slot of partial) {
    const missing = Object.entries(slot.has)
      .filter(([, v]) => !v)
      .map(([k]) => k)
      .join(', ');
    console.log(`\n  ! ${slot.set}/${slot.id} is half-shipped — missing: ${missing}`);
  }

  const blockedSets = [...new Set(blocked.map((s) => s.set))];
  if (blockedSets.length) {
    console.log('\nBlocked, and why');
    for (const name of blockedSets) {
      const first = blocked.find((s) => s.set === name)!;
      console.log(`  ${name}: ${first.blockedBy}`);
    }
  }

  console.log(
    `\nNext: npx tsx scripts/generate-illustrations.ts --set ingredient --limit 8` +
      `\n      (writes to .art-staging/, never straight into assets/food/)`,
  );
}

const invoked = process.argv[1] ? pathToFileURL(resolvePath(process.argv[1])).href : '';
if (invoked === import.meta.url) main();
