/** Concise, factual confirmation for a completed meal save. */
export function mealSavedMessage(names: readonly string[]): string {
  if (names.length === 0) return 'Meal saved.';
  if (names.length === 1) return `Meal saved — ${names[0]} updated.`;
  if (names.length === 2) {
    return `Meal saved — ${names[0]} and ${names[1]} updated.`;
  }
  return `Meal saved — ${names.length} pantry items updated.`;
}

/** Confirms records that were actually created without inventing quantities. */
export function pantryItemsAddedMessage(count: number): string {
  return `Added ${count} item${count === 1 ? '' : 's'} to your pantry.`;
}
