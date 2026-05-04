import LoadingOverlay from 'react-loading-overlay-ts';
import type { ReactNode } from 'react';

const overlayStyles = {
  overlay: (base: React.CSSProperties) => ({
    ...base,
    background: 'rgba(0, 0, 0, 0.7)',
    backdropFilter: 'blur(4px)',
    position: 'fixed' as const,
    zIndex: 9999,
  }),
  content: (base: React.CSSProperties) => ({
    ...base,
    color: '#fff',
    fontSize: '1.25rem',
    fontWeight: 500,
  }),
};

// Single LoadingOverlay configuration shared by every page-level loader.
// Replaces the four-copy duplication that used to live in each component.
export function PageOverlay({
  active,
  text,
  children,
}: {
  active: boolean;
  text: string;
  children: ReactNode;
}) {
  return (
    <LoadingOverlay active={active} spinner text={text} styles={overlayStyles}>
      {children}
    </LoadingOverlay>
  );
}
