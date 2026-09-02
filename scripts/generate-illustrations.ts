/**
 * The Draw Things illustration pipeline.
 *
 *   npx tsx scripts/generate-illustrations.ts --set ingredient --limit 8
 *   npx tsx scripts/generate-illustrations.ts --only broccoli,eggs --force
 *   npx tsx scripts/generate-illustrations.ts --promote broccoli,eggs --reviewer "Tim"
 *   npx tsx scripts/generate-illustrations.ts --set technique --promote all --reviewer "Tim"
 *
 * Generation writes to `.art-staging/` and never touches `assets/food/`.
 * Promotion is the separate, deliberate step that ships art — it copies the
 * file, writes a real provenance entry, and regenerates the registry.
 *
 * That split exists because `assets/food/README.md` makes shipping an asset a
 * human decision: rule 4 is owner acceptance, and a pipeline that wrote
 * straight into the bundle would quietly satisfy rules 1–3 and skip it.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { pathToFileURL } from 'node:url';

import { SET_TARGETS, inventory, type SetName, type Slot } from './asset-inventory';

const ROOT = resolvePath(__dirname, '..');
const STAGING = resolvePath(ROOT, '.art-staging');

const briefs = JSON.parse(
  readFileSync(resolvePath(ROOT, 'assets/illustration-briefs.json'), 'utf8'),
);

/** Same id, same picture — a re-run reproduces rather than re-rolls. */
function seedFor(id: string, salt: number): number {
  const locked = briefs.seedOverrides?.[id];
  if (locked !== undefined && salt === 0) return locked;
  const digest = createHash('sha256').update(`${id}:${salt}`).digest();
  return digest.readUInt32BE(0);
}

function promptFor(slot: Slot): string {
  const exact = briefs.exactPrompts?.[slot.id];
  if (exact) return exact;
  const subject = `${slot.subject.charAt(0).toUpperCase()}${slot.subject.slice(1)}`;
  return `${subject}, ${briefs.style.suffixBySet[slot.set]}`;
}

function sha256(path: string): string {
  return `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}`;
}

function have(binary: string): boolean {
  try {
    execFileSync('which', [binary], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/** A staged image counts only when its sidecar matches the active recipe. */
function isCurrentStaged(slot: Slot): boolean {
  const dir = resolvePath(STAGING, slot.set);
  const output = resolvePath(dir, `${slot.id}.webp`);
  const metadata = resolvePath(dir, `${slot.id}.json`);
  if (!existsSync(output) || !existsSync(metadata)) return false;

  try {
    const meta = JSON.parse(readFileSync(metadata, 'utf8'));
    return (
      meta.workflowVersion === briefs.workflowVersion &&
      meta.model === briefs.model &&
      meta.modelSha256 === briefs.modelSha256 &&
      meta.configFile === briefs.configFile &&
      meta.prompt === promptFor(slot)
    );
  } catch {
    return false;
  }
}

/** Derive a compact review/bundle copy without destroying the paper artwork. */
function prepareReviewAsset(input: string, output: string): void {
  execFileSync('magick', [
    input,
    '-resize', `${briefs.render.stagedWebpSize}x${briefs.render.stagedWebpSize}`,
    '-quality', String(briefs.render.stagedWebpQuality),
    '-define', 'webp:method=6',
    output,
  ]);
}

function generate(slots: Slot[], salt: number, force: boolean): void {
  if (!have('draw-things-cli')) {
    throw new Error('draw-things-cli not found. brew install draw-things-cli');
  }
  if (!have('magick')) {
    throw new Error('ImageMagick not found. brew install imagemagick');
  }

  for (const slot of slots) {
    const dir = resolvePath(STAGING, slot.set);
    mkdirSync(dir, { recursive: true });
    const raw = resolvePath(dir, `${slot.id}.raw.png`);
    const out = resolvePath(dir, `${slot.id}.webp`);

    if (isCurrentStaged(slot) && !force) {
      console.log(`· ${slot.id} already staged (use --force to re-roll)`);
      continue;
    }

    const seed = seedFor(slot.id, salt);
    const started = Date.now();
    execFileSync(
      'draw-things-cli',
      [
        'generate',
        '--model', briefs.model,
        '--prompt', promptFor(slot),
        '--negative-prompt', briefs.style.negative,
        '--width', String(briefs.render.width),
        '--height', String(briefs.render.height),
        '--steps', String(briefs.render.steps),
        '--cfg', String(briefs.render.cfg),
        '--config-file', resolvePath(ROOT, briefs.configFile),
        '--seed', String(seed),
        '--offline',
        '--no-download-missing',
        '--disable-preview',
        '--output', raw,
      ],
      { stdio: 'pipe' },
    );
    prepareReviewAsset(raw, out);

    // The prompt and seed that actually produced this file, beside it, so
    // promotion writes a provenance record it did not have to reconstruct.
    writeFileSync(
      resolvePath(dir, `${slot.id}.json`),
      JSON.stringify(
        {
          id: slot.id,
          set: slot.set,
          prompt: promptFor(slot),
          seed,
          model: briefs.model,
          modelSha256: briefs.modelSha256,
          drawThingsCliVersion: briefs.drawThingsCliVersion,
          configFile: briefs.configFile,
          workflowVersion: briefs.workflowVersion,
          rawPngSha256: sha256(raw),
        },
        null,
        2,
      ),
    );
    console.log(`✓ ${slot.id}  seed ${seed}  ${((Date.now() - started) / 1000).toFixed(1)}s`);
  }
}

/** One sheet to review a batch on, rather than opening forty files. */
function contactSheet(set: string, slots: Slot[]): void {
  const dir = resolvePath(STAGING, set);
  if (!existsSync(dir)) return;
  const requested = new Set(slots.map((slot) => `${slot.id}.webp`));
  const files = readdirSync(dir)
    .filter((file) => requested.has(file))
    .sort();
  if (!files.length) return;
  const sheet = resolvePath(STAGING, `${set}-contact-sheet.png`);
  // No `-label`: a Homebrew ImageMagick without Freetype cannot render text and
  // warns per tile. The order is alphabetical and printed below instead.
  execFileSync('magick', [
    'montage',
    ...files.map((f) => resolvePath(dir, f)),
    '-tile', '5x',
    '-geometry', '200x200+8+8',
    '-background', '#F3EDE4',
    sheet,
  ]);
  console.log(`\nContact sheet: ${sheet}  (${files.length}, left-to-right)`);
  console.log(files.map((f) => f.replace('.webp', '')).join(', '));
}

/**
 * Ship approved art: copy it in, record what made it and who accepted it, and
 * rewrite the registry. `test/food-visuals.test.ts` and
 * `test/illustration-registries.test.ts` then hold all three to agreement, so a
 * partial promotion fails the suite rather than shipping half.
 *
 * Every set promotes through here. Hand-copying a file with a hand-written
 * provenance record is the thing `assets/food/README.md` calls worse than no
 * record at all, so the alternative to this function is not a shortcut — it is a
 * fabricated history.
 */
function promote(set: SetName, ids: string[], reviewer: string): void {
  if (!reviewer) throw new Error('--reviewer is required: approval is a person, not a timestamp.');

  const target = SET_TARGETS[set];
  const slots = new Map(
    inventory()
      .filter((slot) => slot.set === set)
      .map((slot) => [slot.id, slot]),
  );
  const manifestPath = resolvePath(ROOT, target.manifest);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const assetDir = resolvePath(ROOT, target.assetDir);
  mkdirSync(assetDir, { recursive: true });
  const today = new Date().toISOString().slice(0, 10);

  const items = JSON.parse(
    readFileSync(resolvePath(ROOT, 'assets/canonical-items.json'), 'utf8'),
  ) as { id: string; displayName: string; class: string }[];

  for (const id of ids) {
    if (!slots.has(id)) throw new Error(`${id} is not a known ${set} slot`);

    const staged = resolvePath(STAGING, set, `${id}.webp`);
    if (!existsSync(staged)) throw new Error(`${set}/${id} is not staged — generate it first`);
    const meta = JSON.parse(readFileSync(resolvePath(STAGING, set, `${id}.json`), 'utf8'));

    const file = resolvePath(assetDir, `${id}.webp`);
    copyFileSync(staged, file);

    const sourceModel =
      `Draw Things CLI ${meta.drawThingsCliVersion} · ${meta.model} · sha256:${meta.modelSha256}`;
    const license = 'Generated locally for this project; no third-party asset rights claimed.';

    if (set === 'ingredient') {
      const item = items.find((i) => i.id === id);
      if (!item) throw new Error(`${id} is not in assets/canonical-items.json`);
      manifest.assets[target.manifestKey(id)] = {
        canonicalId: id,
        displayName: item.displayName,
        fileName: `${id}.webp`,
        category: item.class,
        sourceModel,
        license,
        promptRecipe: meta.prompt,
        seed: meta.seed,
        workflowVersion: meta.workflowVersion,
        reviewDate: today,
        reviewedBy: reviewer,
        outputChecksum: sha256(file),
      };
    } else {
      manifest.assets[target.manifestKey(id)] = {
        set,
        assetId: id,
        fileName: `${set}/${id}.webp`,
        sourceModel,
        license,
        promptRecipe: meta.prompt,
        seed: meta.seed,
        workflowVersion: meta.workflowVersion,
        reviewDate: today,
        reviewedBy: reviewer,
        outputChecksum: sha256(file),
      };
    }
    console.log(`✓ promoted ${set}/${id}`);
  }

  manifest.generatedAt = today;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const prefix = target.manifestKey('');
  const shipped = Object.keys(manifest.assets)
    .filter((key) => key.startsWith(prefix))
    .map((key) => key.slice(prefix.length))
    .sort();
  writeRegistry(set, shipped);
}

/** Metro cannot bundle a dynamic path, so the registry is generated literals. */
function writeRegistry(set: SetName, ids: string[]): void {
  const target = SET_TARGETS[set];
  const path = resolvePath(ROOT, target.registryFile);
  const source = readFileSync(path, 'utf8');
  const body = ids.length
    ? `{\n${ids
        .map((id) => `  "${id}": require("${target.requirePath(id)}"),`)
        .join('\n')}\n}`
    : '{}';
  const block = new RegExp(`(export const ${target.registryConst}:[^=]*= )[\\s\\S]*?;\\n`);
  if (!block.test(source)) {
    throw new Error(`${target.registryConst} block not found in ${target.registryFile}`);
  }
  writeFileSync(path, source.replace(block, `$1${body};\n`));
  console.log(`✓ ${target.registryConst} now lists ${ids.length}`);
}

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function main(): void {
  if (process.argv.includes('--verify-gold')) {
    const broccoli = inventory().find((slot) => slot.id === 'broccoli');
    if (!broccoli) throw new Error('broccoli gold-master slot is missing');
    generate([broccoli], 0, true);
    const raw = resolvePath(STAGING, broccoli.set, `${broccoli.id}.raw.png`);
    const expected = `sha256:${briefs.goldMasters.broccoli.rawPngSha256}`;
    const actual = sha256(raw);
    if (actual !== expected) {
      throw new Error(`Gold-master mismatch. Expected ${expected}; received ${actual}.`);
    }
    console.log(`✓ broccoli gold master reproduced exactly  ${actual}`);
    return;
  }

  const set = (arg('set') ?? 'ingredient') as SetName;
  if (!(set in SET_TARGETS)) throw new Error(`Unknown set: ${set}`);

  const promoteIds = arg('promote');
  if (promoteIds) {
    const requested = promoteIds.split(',').map((s) => s.trim()).filter(Boolean);
    const ids = requested.length === 1 && requested[0] === 'all'
      ? inventory().filter((slot) => slot.set === set).map((slot) => slot.id)
      : requested;
    promote(set, ids, arg('reviewer') ?? '');
    return;
  }

  const only = arg('only')?.split(',').map((s) => s.trim());
  const limit = Number(arg('limit') ?? '0');
  const salt = Number(arg('salt') ?? '0');
  const force = process.argv.includes('--force');

  let slots = inventory().filter((s) => s.set === set && s.status !== 'done');
  if (only) slots = slots.filter((s) => only.includes(s.id));

  const blocked = slots.find((s) => s.blockedBy);
  if (blocked && !process.argv.includes('--ignore-blocked')) {
    console.error(
      `\n${set} has no wired consumer, so this art would render nowhere:\n  ${blocked.blockedBy}\n\n` +
        `Build the slot first, or pass --ignore-blocked to stage it anyway.`,
    );
    process.exit(1);
  }

  if (!force) slots = slots.filter((slot) => !isCurrentStaged(slot));

  if (limit > 0) slots = slots.slice(0, limit);
  if (!slots.length) {
    console.log('Nothing to generate.');
    return;
  }

  console.log(`Generating ${slots.length} ${set} illustration(s)\n`);
  generate(slots, salt, force);
  const reviewSlots = inventory().filter(
    (slot) => slot.set === set && isCurrentStaged(slot),
  );
  contactSheet(set, reviewSlots);
  console.log(
    `\nReview the sheet, re-roll any you dislike with --only <id> --force --salt 1,\n` +
      `then ship them: --promote <ids> --reviewer "<your name>"`,
  );
}

const invoked = process.argv[1] ? pathToFileURL(resolvePath(process.argv[1])).href : '';
if (invoked === import.meta.url) main();
