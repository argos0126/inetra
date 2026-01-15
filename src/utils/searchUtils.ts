export function searchItems<T>(items: T[], searchTerm: string, searchFields: (keyof T)[]): T[] {
  if (!searchTerm.trim()) return items;
  
  const lowercaseSearch = searchTerm.toLowerCase();
  
  return items.filter(item => 
    searchFields.some(field => {
      const value = item[field];
      if (typeof value === 'string') {
        return value.toLowerCase().includes(lowercaseSearch);
      }
      if (typeof value === 'number') {
        return value.toString().includes(lowercaseSearch);
      }
      return false;
    })
  );
}

export function sortItems<T>(items: T[], sortField: keyof T, sortDirection: 'asc' | 'desc'): T[] {
  return [...items].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];
    
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      const comparison = aValue.localeCompare(bValue);
      return sortDirection === 'asc' ? comparison : -comparison;
    }
    
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    }
    
    return 0;
  });
}

export function filterByStatus<T extends { status: string }>(items: T[], status?: string): T[] {
  if (!status || status === 'all') return items;
  return items.filter(item => item.status.toLowerCase() === status.toLowerCase());
}