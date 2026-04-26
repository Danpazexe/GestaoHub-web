export const PanelSection = ({ title, subtitle, actions, kicker, children }) => (
  <section className="panel-section">
    <div className="panel-section-glow" aria-hidden="true" />
    <header className="section-header">
      <div className="section-copy">
        <span className="section-kicker">{kicker || 'Painel'}</span>
        <div className="section-title-row">
          <h2>{title}</h2>
        </div>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions ? <div className="section-actions">{actions}</div> : null}
    </header>
    <div className="section-divider" aria-hidden="true" />
    <div className="section-body">{children}</div>
  </section>
);
