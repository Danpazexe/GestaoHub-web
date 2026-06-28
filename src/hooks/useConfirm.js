import { createElement, useState } from 'react';
import { ConfirmModal } from '../components/ConfirmModal';

const initialState = {
  open: false,
  config: null,
  resolve: null,
};

export const useConfirm = () => {
  const [state, setState] = useState(initialState);
  const [reason, setReason] = useState('');

  const close = (result) => {
    state.resolve?.(result);
    setState(initialState);
    setReason('');
  };

  const confirm = (config) => new Promise((resolve) => {
    setReason('');
    setState({ open: true, config, resolve });
  });

  const requireReason = Boolean(state.config?.requireReason);

  // Com requireReason, resolve a STRING do motivo (truthy); senão resolve true.
  // Cancelar resolve false. Callers podem fazer `const r = await confirm(...)`.
  // Sem useMemo: createElement é barato e o elemento depende de close (instável).
  const ConfirmModalNode = createElement(ConfirmModal, {
    open: state.open,
    title: state.config?.title || 'Confirmar ação',
    description: state.config?.description || '',
    confirmLabel: state.config?.confirmLabel || 'Confirmar',
    cancelLabel: state.config?.cancelLabel || 'Cancelar',
    danger: Boolean(state.config?.danger),
    requireReason,
    reasonLabel: state.config?.reasonLabel || 'Motivo (obrigatório)',
    reasonValue: reason,
    onReasonChange: setReason,
    onConfirm: () => close(requireReason ? reason.trim() : true),
    onCancel: () => close(false),
  });

  return { confirm, ConfirmModalNode };
};
