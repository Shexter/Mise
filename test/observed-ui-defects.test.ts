import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const sheet = readFileSync('src/components/Sheet.tsx', 'utf8');
const mealEditor = readFileSync('app/meal/[id].tsx', 'utf8');
const checklist = readFileSync('docs/owner-app-test-checklist.md', 'utf8');
const checklistProse = checklist.replace(/\s+/g, ' ');

describe('observed Android UI defect remediation', () => {
  it('gives sheet content a keyboard-resized scrollable viewport', () => {
    expect(sheet).toContain("behavior={Platform.OS === 'ios' ? 'padding' : 'height'}");
    expect(sheet).toContain('keyboardVerticalOffset={insets.top}');
    expect(sheet).toContain("keyboardArea: { flex: 1, width: '100%', justifyContent: 'flex-end' }");
    expect(sheet).toContain('keyboardShouldPersistTaps="handled"');
  });

  it('does not compress four meal units into a narrow segmented row', () => {
    expect(mealEditor).toContain('options={UNIT_OPTIONS.slice(0, 3)}');
    expect(mealEditor).toContain('options={UNIT_OPTIONS.slice(3, 6)}');
    expect(mealEditor).toContain('options={UNIT_OPTIONS.slice(6)}');
    expect(mealEditor).not.toContain('options={UNIT_OPTIONS.slice(0, 4)}');
  });

  it('keeps device confirmation open after code remediation', () => {
    expect(checklist).toContain('- [ ] **Keyboard-obscured input:**');
    expect(checklist).toContain('- [ ] **Manual unit control wraps labels:**');
    expect(checklistProse).toContain('repeat this check before closing the defect');
    expect(checklistProse).toContain('repeat this check at normal and large text');
  });
});
