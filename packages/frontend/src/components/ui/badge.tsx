import * as React from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'destructive' | 'secondary';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40',
  secondary: 'bg-gray-700 text-gray-300 border border-gray-600',
  success: 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40',
  warning: 'bg-amber-600/30 text-amber-300 border border-amber-500/40',
  destructive: 'bg-red-600/30 text-red-300 border border-red-500/40',
};

export const Badge = ({ variant = 'default', className = '', children, ...props }: BadgeProps) => {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        variantClasses[variant],
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </span>
  );
};
