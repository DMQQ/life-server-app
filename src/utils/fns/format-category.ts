export function formatCategory(category: string): string {
  if (!category) return 'Uncategorized';

  return category.split(':').pop()?.trim();
}

export function getMainCategory(category: string): string {
  if (!category) return 'Uncategorized';

  const parts = category.split(':');
  return parts.length > 1 ? parts[0].trim() : 'Uncategorized';
}
