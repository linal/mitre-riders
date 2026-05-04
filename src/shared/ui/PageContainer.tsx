import type { ReactNode } from 'react';

// Full-bleed page wrapper using Tailwind `dark:` variants. Components no
// longer need to read `darkMode` from context just to render the right
// background colour.
export function PageContainer({ children }: { children: ReactNode }) {
  return (
    <div className="p-4 space-y-4 bg-white dark:bg-gray-900 dark:text-white">
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="border-l-4 border-blue-600 rounded shadow-md p-4 mb-6 mx-2 bg-white dark:bg-gray-800">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-medium text-gray-800 dark:text-white">{title}</h3>
        {actions}
      </div>
      {description && (
        <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">{description}</p>
      )}
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 p-3 rounded">
      {message}
    </div>
  );
}

export function SuccessBanner({ message }: { message: string }) {
  return (
    <div className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 p-3 rounded">
      {message}
    </div>
  );
}
