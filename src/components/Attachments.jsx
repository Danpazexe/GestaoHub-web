import { useEffect, useRef, useState } from 'react';
import { adminApi } from '../services/adminApi';
import { toast } from '../lib/toast';
import { formatDateTime } from '../lib/format';

// Anexos/comprovantes (§23) de uma entidade. Upload (máx 10 MB), lista com
// download via URL assinada e remoção. Degrada se a migração 0014 não rodou.
export const Attachments = ({ documentType, documentId, title = 'Anexos / comprovantes' }) => {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const inputRef = useRef(null);

  const refresh = () => setVersion((v) => v + 1);

  useEffect(() => {
    if (!documentId) return undefined;
    let alive = true;
    adminApi.listAttachments(documentType, documentId)
      .then((r) => { if (alive) setItems(r); })
      .catch(() => {});
    return () => { alive = false; };
  }, [documentType, documentId, version]);

  const onPick = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('Arquivo muito grande (máx. 10 MB).'); return; }
    setBusy(true);
    try {
      await adminApi.uploadAttachment(file, { documentType, documentId });
      refresh();
      toast.success('Anexo enviado.');
    } catch (error) {
      toast.error(error?.message || 'Falha ao enviar o anexo.');
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (it) => {
    setBusy(true);
    try {
      await adminApi.deleteAttachment(it.id, it.file_path);
      refresh();
      toast.success('Anexo removido.');
    } catch (error) {
      toast.error(error?.message || 'Falha ao remover o anexo.');
    } finally {
      setBusy(false);
    }
  };

  if (!documentId) return null;

  return (
    <section className="attachments">
      <div className="attachments-head">
        <h4 className="profile-section-title">{title}</h4>
        <button type="button" className="ghost-button" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? 'Enviando...' : 'Anexar arquivo'}
        </button>
        <input ref={inputRef} type="file" hidden onChange={onPick} />
      </div>
      {items.length === 0 ? (
        <p className="config-hint">Nenhum comprovante anexado.</p>
      ) : (
        <ul className="attachments-list">
          {items.map((it) => (
            <li key={it.id} className="attachments-item">
              {it.url
                ? <a href={it.url} target="_blank" rel="noreferrer" className="link-button">{it.file_name || 'arquivo'}</a>
                : <span>{it.file_name || 'arquivo'}</span>}
              <span className="attachments-meta">{formatDateTime(it.uploaded_at)}</span>
              <button type="button" className="attachments-remove" onClick={() => onDelete(it)} disabled={busy}>Remover</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
