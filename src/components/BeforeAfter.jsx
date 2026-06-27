// Comparação "antes e depois" (briefing §8). Recebe duas listas de campos
// { label, value } e um motivo opcional, deixando a correção clara e auditável.
export const BeforeAfter = ({ before = [], after = [], reason }) => (
  <div className="before-after">
    <div className="ba-cols">
      <div className="ba-col ba-before">
        <h5>Antes</h5>
        {before.map((field) => (
          <div className="ba-field" key={`b-${field.label}`}>
            <span className="ba-label">{field.label}</span>
            <span className="ba-value">{field.value ?? '—'}</span>
          </div>
        ))}
      </div>
      <span className="ba-arrow" aria-hidden="true">→</span>
      <div className="ba-col ba-after">
        <h5>Depois</h5>
        {after.map((field) => {
          const beforeField = before.find((b) => b.label === field.label);
          const changed = beforeField && String(beforeField.value) !== String(field.value);
          return (
            <div className={`ba-field${changed ? ' is-changed' : ''}`} key={`a-${field.label}`}>
              <span className="ba-label">{field.label}</span>
              <span className="ba-value">{field.value ?? '—'}</span>
            </div>
          );
        })}
      </div>
    </div>
    {reason ? (
      <div className="ba-reason"><span>Motivo</span>{reason}</div>
    ) : null}
  </div>
);
