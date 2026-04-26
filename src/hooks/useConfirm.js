import { createElement, useMemo, useState } from 'react';
import { ConfirmModal } from '../components/ConfirmModal';

const initialState = {
  open: false,
  config: null,
  resolve: null,
};

export const useConfirm = () => {
  const [state, setState] = useState(initialState);

  const close = (result) => {
    state.resolve?.(result);
    setState(initialState);
  };

  const confirm = (config) => new Promise((resolve) => {
    setState({
      open: true,
      config,
      resolve,
    });
  });

  const ConfirmModalNode = useMemo(() => createElement(ConfirmModal, {
    open: state.open,
    title: state.config?.title || 'Confirmar ação',
    description: state.config?.description || '',
    confirmLabel: state.config?.confirmLabel || 'Confirmar',
    cancelLabel: state.config?.cancelLabel || 'Cancelar',
    danger: Boolean(state.config?.danger),
    onConfirm: () => close(true),
    onCancel: () => close(false),
  }), [state]);

  return { confirm, ConfirmModalNode };
};
