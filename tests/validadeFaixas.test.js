import { describe, it, expect } from 'vitest';
import { classifyValidade, DEFAULT_FAIXAS } from '../src/lib/validadeFaixas';

// Faixas: vencido (<0) | hoje (0) | critico (<=7) | atencao (<=15) | monitorar (<=30) | seguro
describe('classifyValidade', () => {
  const f = DEFAULT_FAIXAS;

  it('classifica vencido para dias negativos', () => {
    expect(classifyValidade(-1, f).key).toBe('vencido');
    expect(classifyValidade(-30, f).tone).toBe('danger');
  });

  it('classifica "hoje" para 0', () => {
    expect(classifyValidade(0, f).key).toBe('hoje');
  });

  it('respeita os limites crítico/atenção/monitorar (defaults 7/15/30)', () => {
    expect(classifyValidade(7, f).key).toBe('critico');
    expect(classifyValidade(8, f).key).toBe('atencao');
    expect(classifyValidade(15, f).key).toBe('atencao');
    expect(classifyValidade(16, f).key).toBe('monitorar');
    expect(classifyValidade(30, f).key).toBe('monitorar');
    expect(classifyValidade(31, f).key).toBe('seguro');
  });

  it('usa limites customizados', () => {
    const custom = { criticoDias: 3, atencaoDias: 5, monitorarDias: 10 };
    expect(classifyValidade(3, custom).key).toBe('critico');
    expect(classifyValidade(4, custom).key).toBe('atencao');
    expect(classifyValidade(9, custom).key).toBe('monitorar');
    expect(classifyValidade(11, custom).key).toBe('seguro');
  });

  it('trata dias não numéricos como desconhecido', () => {
    // Number(undefined) e Number('abc') são NaN → desconhecido.
    expect(classifyValidade(undefined, f).key).toBe('desconhecido');
    expect(classifyValidade('abc', f).key).toBe('desconhecido');
    // Number(null) é 0 → "vence hoje" (comportamento existente preservado).
    expect(classifyValidade(null, f).key).toBe('hoje');
  });
});
