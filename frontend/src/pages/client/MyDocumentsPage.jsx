/**
 * MyDocumentsPage — Client file management
 * Upload CIN, contracts, invoices and other documents
 */
import { useState, useEffect, useRef } from 'react';
import { documentsAPI } from '../../services/api';
import {
  FolderOpen, Upload, Download, Trash2,
  FileText, Image, File, AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const DOC_TYPE_MAP = {
  cin:      { label: 'CIN',       color: 'var(--accent)',        bg: 'var(--accent-dim)' },
  contract: { label: 'Contrat',   color: 'var(--primary-light)', bg: 'var(--primary-dim)' },
  invoice:  { label: 'Facture',   color: 'var(--success)',       bg: 'var(--success-dim)' },
  other:    { label: 'Autre',     color: 'var(--text-muted)',    bg: 'rgba(148,148,184,0.1)' },
};

function FileIcon({ mime }) {
  if (!mime) return <File size={20} />;
  if (mime.startsWith('image/')) return <Image size={20} />;
  return <FileText size={20} />;
}

function formatSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

export default function MyDocumentsPage() {
  const [docs, setDocs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  const [form, setForm] = useState({
    name: '', doc_type: 'other', description: '', file: null
  });

  const load = () => {
    setLoading(true);
    documentsAPI.list()
      .then(r => setDocs(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleFileSelect = (file) => {
    if (!file) return;
    setForm(f => ({ ...f, file, name: f.name || file.name.replace(/\.[^.]+$/, '') }));
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!form.file) { setError('Sélectionnez un fichier'); return; }
    setError(''); setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', form.file);
      fd.append('name', form.name || form.file.name);
      fd.append('doc_type', form.doc_type);
      if (form.description) fd.append('description', form.description);
      await documentsAPI.upload(fd);
      setSuccess('Document uploadé avec succès !');
      setShowUpload(false);
      setForm({ name: '', doc_type: 'other', description: '', file: null });
      load();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur upload');
    } finally { setUploading(false); }
  };

  const handleDownload = async (doc) => {
    try {
      const { data } = await documentsAPI.download(doc.id);
      const url = window.URL.createObjectURL(new Blob([data]));
      const a = document.createElement('a');
      a.href = url; a.download = doc.original_filename; a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce document ?')) return;
    await documentsAPI.delete(id);
    load();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Mes Documents</h1>
          <p className="page-subtitle">{docs.length} document(s) uploadé(s)</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowUpload(true)}>
          <Upload size={16} /> Uploader un document
        </button>
      </div>

      {success && (
        <div className="alert alert-success" style={{ marginBottom: 20 }}>
          ✅ {success}
        </div>
      )}

      {/* Upload dropzone hint */}
      {docs.length === 0 && !loading && (
        <div
          style={styles.dropZoneMain}
          onClick={() => setShowUpload(true)}
        >
          <FolderOpen size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
          <h3 style={{ fontSize: 17, marginBottom: 6 }}>Aucun document</h3>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>
            Déposez vos fichiers ici ou cliquez pour uploader
          </p>
          <button className="btn btn-primary">
            <Upload size={16} /> Uploader maintenant
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
      ) : docs.length > 0 && (
        <div style={styles.docGrid}>
          {docs.map(doc => {
            const typeInfo = DOC_TYPE_MAP[doc.doc_type] || DOC_TYPE_MAP.other;
            return (
              <div key={doc.id} className="card card-hover" style={styles.docCard}>
                {/* Icon */}
                <div style={{ ...styles.docIcon, background: typeInfo.bg, color: typeInfo.color }}>
                  <FileIcon mime={doc.mime_type} />
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {doc.name}
                    </span>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {doc.original_filename}
                  </p>
                  <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
                    <span style={{ ...styles.typeTag, background: typeInfo.bg, color: typeInfo.color }}>
                      {typeInfo.label}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatSize(doc.file_size)}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {format(new Date(doc.uploaded_at), 'dd MMM yyyy', { locale: fr })}
                    </span>
                  </div>
                  {doc.description && (
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic' }}>
                      {doc.description}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button className="btn btn-icon btn-secondary btn-sm" onClick={() => handleDownload(doc)} title="Télécharger">
                    <Download size={14} />
                  </button>
                  <button className="btn btn-icon btn-danger btn-sm" onClick={() => handleDelete(doc.id)} title="Supprimer">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowUpload(false)}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h2 className="modal-title">Uploader un document</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowUpload(false)}>✕</button>
            </div>

            {error && <div className="alert alert-error" style={{ marginBottom: 16 }}><AlertCircle size={14} /> {error}</div>}

            <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* File drop area */}
              <div
                style={{
                  ...styles.dropZone,
                  borderColor: dragOver ? 'var(--primary)' : form.file ? 'var(--success)' : 'var(--border)',
                  background: dragOver ? 'var(--primary-dim)' : form.file ? 'var(--success-dim)' : 'var(--bg-elevated)',
                }}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); handleFileSelect(e.dataTransfer.files[0]); }}
                onClick={() => fileRef.current?.click()}
              >
                <input
                  ref={fileRef} type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  style={{ display: 'none' }}
                  onChange={e => handleFileSelect(e.target.files[0])}
                />
                {form.file ? (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
                    <p style={{ fontWeight: 600, color: 'var(--success)' }}>{form.file.name}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{formatSize(form.file.size)}</p>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center' }}>
                    <Upload size={28} style={{ opacity: 0.4, marginBottom: 10 }} />
                    <p style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>Glissez un fichier ou cliquez</p>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>PDF, JPEG, PNG, DOC, DOCX — Max 10 Mo</p>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Nom du document *</label>
                <input
                  className="form-input"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Mon CIN, Contrat 2024..."
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Type de document</label>
                <select className="form-input" value={form.doc_type} onChange={e => setForm({ ...form, doc_type: e.target.value })}>
                  <option value="cin">CIN</option>
                  <option value="contract">Contrat</option>
                  <option value="invoice">Facture</option>
                  <option value="other">Autre</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Description (optionnel)</label>
                <input
                  className="form-input"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Notes supplémentaires..."
                />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setShowUpload(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={uploading || !form.file}>
                  {uploading ? <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <><Upload size={14} /> Uploader</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  docGrid: {
    display: 'flex', flexDirection: 'column', gap: 12,
  },
  docCard: {
    display: 'flex', alignItems: 'center', gap: 16,
    padding: '16px 20px',
  },
  docIcon: {
    width: 44, height: 44, borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  typeTag: {
    fontSize: 11, fontWeight: 500,
    padding: '2px 8px', borderRadius: 99,
  },
  dropZoneMain: {
    border: '2px dashed var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: 60, textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
    color: 'var(--text-muted)',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
  },
  dropZone: {
    border: '2px dashed', borderRadius: 12,
    padding: '32px 20px', textAlign: 'center',
    cursor: 'pointer', transition: 'all 0.2s',
    color: 'var(--text-muted)',
  },
};
