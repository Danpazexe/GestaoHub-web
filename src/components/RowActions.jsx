import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// Menu de ações de linha (⋯) que abre um dropdown, no lugar de vários botões
// repetidos por linha. Usa portal + posição fixa para não ser cortado pelo
// overflow da tabela; fecha ao clicar fora ou rolar.
// actions: [{ label, onClick, danger }]
export const RowActions = ({ actions = [] }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => {
      if (triggerRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const onScroll = () => setOpen(false);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  const toggle = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: Math.max(8, rect.right - 172) });
    }
    setOpen((value) => !value);
  };

  const items = actions.filter(Boolean);
  if (!items.length) return null;

  return (
    <>
      <button ref={triggerRef} type="button" className="row-actions-trigger" onClick={toggle} aria-label="Ações" aria-haspopup="menu" title="Ações">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" />
        </svg>
      </button>
      {open ? createPortal(
        <div ref={menuRef} className="row-actions-menu" role="menu" style={{ top: pos.top, left: pos.left }}>
          {items.map((action) => (
            <button
              type="button"
              key={action.label}
              role="menuitem"
              className={`row-actions-item${action.danger ? ' is-danger' : ''}`}
              onClick={() => { action.onClick?.(); setOpen(false); }}
            >
              {action.label}
            </button>
          ))}
        </div>,
        document.body,
      ) : null}
    </>
  );
};
