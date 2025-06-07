'use client';

import { Icon } from '@iconify/react';
import type { ReactNode } from 'react';

type Variant = 'success' | 'info' | 'warning' | 'error';

const iconMap: Record<Variant, string> = {
  success: 'mdi:check',
  info: 'mdi:information-outline',
  warning: 'mdi:alert-outline',
  error: 'mdi:close-circle-outline',
};

const wrapperClassMap: Record<Variant, string> = {
  success:
    'bg-green-50 border-green-200 text-green-900 dark:bg-green-900/20 dark:border-green-800 dark:text-green-100',
  info:
    'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-100',
  warning:
    'bg-yellow-50 border-yellow-200 text-yellow-900 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-100',
  error:
    'bg-red-50 border-red-200 text-red-900 dark:bg-red-900/20 dark:border-red-800 dark:text-red-100',
};

const iconColorMap: Record<Variant, string> = {
  success: 'text-green-500 dark:text-green-100',
  info: 'text-blue-500 dark:text-blue-100',
  warning: 'text-yellow-500 dark:text-yellow-100',
  error: 'text-red-500 dark:text-red-100',
};

export function Callout({
  variant = 'info',
  title,
  children,
}: {
  variant?: string;
  title?: string;
  children: ReactNode;
}) {
  const safeVariant: Variant = (['success', 'info', 'warning', 'error'].includes(variant || '')
    ? variant
    : 'info') as Variant;

  return (
    <div
      className={`rounded-xl px-4 py-3 flex gap-3 border ${wrapperClassMap[safeVariant]} [&>div>p]:m-0`}
    >
      <div className="pt-1.5">
        <Icon
          icon={iconMap[safeVariant]}
          className={iconColorMap[safeVariant]}
          width={18}
        />
      </div>
      <div>
        {title && <p className="font-semibold">{title}</p>}
        {children}
      </div>
    </div>
  );
}
