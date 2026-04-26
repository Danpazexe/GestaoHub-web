import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export const Drawer = ({
  open,
  title,
  onClose,
  children,
  width = 480,
}) => {
  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

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
          <h3>{title}</h3>
          <button
            type="button"
            className="ghost-button drawer-close"
            onClick={onClose}
            title="Fechar painel lateral"
          >
            Fechar
          </button>
        </header>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>,
    document.body,
  );
};
