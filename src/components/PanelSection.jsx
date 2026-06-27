export const PanelSection = ({ title, subtitle, actions, kicker, children }) => (
  <section className="panel-section">
    <header className="section-header">
      <div className="section-copy">
        {kicker ? <span className="section-kicker">{kicker}</span> : null}
        <div className="section-title-row">
          <h2>{title}</h2>
        </div>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions ? <div className="section-actions">{actions}</div> : null}
    </header>
    <div className="section-body">{children}</div>
  </section>
);
