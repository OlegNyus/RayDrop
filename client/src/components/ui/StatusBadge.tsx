import type { TestCaseStatus } from '../../types';

interface StatusBadgeProps {
  status: TestCaseStatus | string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config: Record<string, { label: string; bg: string; text: string }> = {
    new: { label: 'New', bg: 'bg-blue-500', text: 'text-white' },
    draft: { label: 'Draft', bg: 'bg-amber-500', text: 'text-white' },
    ready: { label: 'Ready', bg: 'bg-green-500', text: 'text-white' },
    imported: { label: 'Imported', bg: 'bg-emerald-600', text: 'text-white' },
  };

  const { label, bg, text } = config[status] || { label: status, bg: 'bg-gray-500', text: 'text-white' };
  
  const sizeClasses = size === 'sm' 
    ? 'px-2 py-0.5 text-xs' 
    : 'px-2.5 py-1 text-xs';

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${sizeClasses} ${bg} ${text}`}>
      {label}
    </span>
  );
}
