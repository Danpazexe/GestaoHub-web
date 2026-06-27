import { useState } from 'react';
import { adminApi } from '../services/adminApi';

export const LoginForm = ({ onSuccess, disabled, globalError }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await adminApi.signIn(email, password);
      onSuccess?.();
    } catch (submitError) {
      setError(submitError?.message || 'Falha ao autenticar.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-brand">
        <div className="login-logo">
          <div className="login-logo-mark" aria-hidden="true">GH</div>
          <div className="login-logo-text">
            <span className="login-logo-name">GestãoHub</span>
            <span className="login-logo-sub">Supervisão</span>
          </div>
        </div>
        <span className="eyebrow">Plataforma de supervisão</span>
        <h1>Sua operação sob controle, em tempo real.</h1>
        <p>Acompanhe validade, conferências, recebimento e equipe — tudo num só lugar.</p>
        <ul className="login-points">
          <li>Operação ao vivo e equipe conectada</li>
          <li>Conferências, recebimento e tratativas</li>
          <li>Validade, pendências e auditoria</li>
        </ul>
      </div>

      <div className="login-right">
        <form className="login-card" onSubmit={handleSubmit} noValidate>
          <h2>Entrar</h2>
          <p>Use seu e-mail e senha de acesso para continuar.</p>

          <label className="field">
            <span>E-mail</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@empresa.com"
              disabled={disabled || submitting}
              required
              autoComplete="email"
            />
          </label>

          <label className="field">
            <span>Senha</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Sua senha"
              disabled={disabled || submitting}
              required
              autoComplete="current-password"
            />
          </label>

          {error ? <div className="feedback error" role="alert">{error}</div> : null}
          {globalError ? <div className="feedback warning" role="alert">{globalError}</div> : null}

          <button className="primary-button" type="submit" disabled={disabled || submitting}>
            {submitting ? 'Entrando...' : 'Entrar no painel'}
          </button>
        </form>
      </div>
    </div>
  );
};
