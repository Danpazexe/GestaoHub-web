import { AppIcon } from './AppIcon';

// Estado vazio rico (ícone + título + descrição + ação opcional), substituindo
// a antiga caixa tracejada com texto/emoji. Usado pela DataTable e pelas telas.
export const EmptyState = ({ icon = 'overview', title, description, action, compact = false }) => (
  <div className={compact ? 'empty-state compact-empty' : 'empty-state'} role="status">
    <span className="empty-icon" aria-hidden="true"><AppIcon name={icon} size={22} /></span>
    {title ? <strong className="empty-title">{title}</strong> : null}
    {description ? <p className="empty-desc">{description}</p> : null}
    {action ? <div className="empty-action">{action}</div> : null}
  </div>
);
