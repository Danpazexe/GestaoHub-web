import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export const Drawer = ({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  width = 480,
}) => {
  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => { if (event.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="drawer-overlay" role="presentation" onClick={onClose}>
      <aside
        className="drawer"
        role="complementary"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        style={{ '--drawer-width': `${width}px` }}
      >
        <header className="drawer-header">
          <div className="drawer-heading">
            <h3>{title}</h3>
            {subtitle ? <span className="drawer-subtitle">{subtitle}</span> : null}
          </div>
          <button type="button" className="drawer-close" onClick={onClose} aria-label="Fechar" title="Fechar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>
        <div className="drawer-body">{children}</div>
        {footer ? <footer className="drawer-footer">{footer}</footer> : null}
      </aside>
    </div>,
    document.body,
  );
};
