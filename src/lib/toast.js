import { toast as hotToast } from 'react-hot-toast';

const baseStyle = {
  fontFamily: 'var(--font-body)',
  fontSize: '13px',
  borderRadius: 'var(--r-md)',
  border: '1px solid var(--line)',
  background: 'var(--surface-2)',
  color: 'var(--ink)',
};

export const toast = {
  success: (message) => hotToast.success(message, { style: baseStyle, duration: 3500 }),
  error: (message) => hotToast.error(message, { style: baseStyle, duration: 5000 }),
  loading: (message) => hotToast.loading(message, { style: baseStyle }),
  dismiss: (id) => hotToast.dismiss(id),
};
