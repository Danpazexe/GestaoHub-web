import { Component } from 'react';

/**
 * Evita que um erro de runtime numa view derrube o painel inteiro (tela branca).
 * Mostra a mensagem do erro + botão de retry. Use com key={view} para resetar ao trocar de tela.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <div className="feedback error" style={{ display: 'grid', gap: 8 }}>
          <strong>Algo quebrou ao renderizar esta tela.</strong>
          <span style={{ fontSize: 12, opacity: 0.85, wordBreak: 'break-word' }}>
            {String(error?.message || error)}
          </span>
          <button
            type="button"
            className="ghost-button"
            style={{ justifySelf: 'start' }}
            onClick={() => this.setState({ error: null })}
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
