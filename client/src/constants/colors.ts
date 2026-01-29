// Shared color constants for consistent styling across components

// Review status colors
export const REVIEW_COLORS = {
  underReview: '#3B82F6', // blue-500
  xrayDraft: '#F97316',   // orange-500 (for stat cards)
  localDraft: '#F59E0B',  // amber-500
} as const;

// Sidebar badge colors (using lighter shades for readability)
export const SIDEBAR_BADGE_COLORS = {
  underReview: {
    bg: 'bg-blue-100',
    text: 'text-blue-700',
  },
  xrayDraft: {
    bg: 'bg-red-100',
    text: 'text-red-700',
  },
} as const;

// Priority colors for test cases
export const PRIORITY_COLORS: Record<string, string> = {
  Highest: '#DC2626', // red-600
  High: '#EA580C',    // orange-600
  Medium: '#F59E0B',  // amber-500
  Low: '#22C55E',     // green-500
  Lowest: '#6B7280',  // gray-500
};

// Priority sort order (lower = higher priority)
export const PRIORITY_ORDER: Record<string, number> = {
  Highest: 0,
  High: 1,
  Medium: 2,
  Low: 3,
  Lowest: 4,
};
