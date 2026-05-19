import { useEffect, useMemo, useState } from 'react';
import { erpAPI } from '../../services/api';
import { FileText, Package, CheckCircle, AlertTriangle, History, Filter, FolderInput, FileSpreadsheet } from 'lucide-react';

function downloadBlob(response, fallbackName) {
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  const disposition = response.headers?.['content-disposition'];
  const match = disposition?.match(/filename="?([^";]+)"?/i);
  link.download = match?.[1] || fallbackName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export default function ErpSagePage() {
  const [mapping, setMapping] = useState(null);
  const [preview, setPreview] = useState(null);
  const [history, setHistory] = useState([]);
  const [filters, setFilters] = useState({ start_date: '', end_date: '', only_not_exported: true });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [folderResult, setFolderResult] = useState(null);

  const params = useMemo(() => ({
    start_date: filters.start_date || undefined,
    end_date: filters.end_date || undefined,
    only_not_exported: filters.only_not_exported,
  }), [filters]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [m, p, h] = await Promise.all([erpAPI.sageMapping(), erpAPI.sagePreview(params), erpAPI.sageHistory().catch(() => ({ data: [] }))]);
      setMapping(m.data);
      setPreview(p.data);
      setHistory(h.data || []);
    } catch (err) {
      setError(err.response?.data?.detail?.message || err.response?.data?.detail || 'Erreur chargement intégration Sage');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleExportTxt = async () => {
    setBusy('txt'); setError('');
    try {
      const res = await erpAPI.exportSageToFolder(params);
      setFolderResult(res.data);
      await load();
    } catch (err) {
      setError(JSON.stringify(err.response?.data?.detail || 'Erreur export Sage TXT vers dossier'));
    }
    finally { setBusy(''); }
  };

  const handleExportZip = async () => {
    setBusy('zip'); setError('');
    try { downloadBlob(await erpAPI.exportSageZip(params), 'SAGE_VENTES_PAR_PERIODE.zip'); }
    catch (err) { setError(JSON.stringify(err.response?.data?.detail || 'Erreur export ZIP')); }
    finally { setBusy(''); }
  };

  const handleExportExcel = async () => {
    setBusy('excel'); setError('');
    try { downloadBlob(await erpAPI.exportSageExcel(params), 'SAGE_CANVAS_COMPTABILITE.xlsx'); }
    catch (err) { setError(JSON.stringify(err.response?.data?.detail || 'Erreur export Excel')); }
    finally { setBusy(''); }
  };

  const handleExportToFolder = async () => {
    setBusy('folder'); setError(''); setFolderResult(null);
    try { const res = await erpAPI.exportSageToFolder(params); setFolderResult(res.data); }
    catch (err) { setError(JSON.stringify(err.response?.data?.detail || 'Erreur préparation dossier Sage')); }
    finally { setBusy(''); }
  };

  if (loading) return <div className="grid-3">{Array.from({ length: 6 }).map((_, i) => <div className="skeleton-card" key={i} />)}</div>;

  return (
    <div className="dash-enter">
      <div className="erp-hero sage-hero">
        <div>
          <span className="eyebrow">Sage 100 i7 / JJMMAA</span>
          <h1>Centre ERP Sage</h1>
          <p>Export TXT compatible Sage, ZIP par période, Excel canvas comptabilité, historique et suivi des factures déjà exportées.</p>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}><AlertTriangle size={16} /> {error}</div>}

      <div className="card glass-card" style={{ marginBottom: 20 }}>
        <div className="section-heading"><h3><Filter size={18} /> Filtres d’export</h3><span>{preview?.invoice_count_previewed || 0} facture(s), {Number(preview?.total_amount || 0).toLocaleString()} MAD</span></div>
        <div className="filter-bar">
          <label className="form-group"><span className="form-label">Date début</span><input className="form-input" type="date" value={filters.start_date} onChange={e => setFilters(f => ({ ...f, start_date: e.target.value }))} /></label>
          <label className="form-group"><span className="form-label">Date fin</span><input className="form-input" type="date" value={filters.end_date} onChange={e => setFilters(f => ({ ...f, end_date: e.target.value }))} /></label>
          <label className="toggle-line"><input type="checkbox" checked={filters.only_not_exported} onChange={e => setFilters(f => ({ ...f, only_not_exported: e.target.checked }))} /> Seulement non exportées</label>
          <button className="btn btn-primary" onClick={load}><Filter size={16} /> Appliquer</button>
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: 'stretch' }}>
        <div className="card glass-card">
          <div className="section-heading"><h3>Configuration Sage</h3><span>à créer une seule fois</span></div>
          <div className="sage-config-grid">
            <Info label="Type fichier" value={mapping?.type_fichier} />
            <Info label="Origine" value={mapping?.origine} />
            <Info label="Délimiteur champ" value={mapping?.delimiteur_champ} />
            <Info label="Entête" value={mapping?.entete} />
            <Info label="Date" value={mapping?.format_date} />
            <Info label="Montants" value={mapping?.format_montant} />
          </div>
        </div>

        <div className="card glass-card">
          <div className="section-heading"><h3>Exports</h3><span>TXT Sage / Excel / ZIP / dossier</span></div>
          <div className="action-grid">
            <button className="btn btn-primary btn-glow" onClick={handleExportTxt} disabled={!!busy}><FileText size={16} /> {busy === 'txt' ? 'Export...' : 'Exporter TXT vers C:\\SAGE_AUTO_IMPORT\\pending'}</button>
            <button className="btn btn-success modern-btn" onClick={handleExportExcel} disabled={!!busy}><FileSpreadsheet size={16} /> {busy === 'excel' ? 'Export...' : 'Exporter Excel canvas'}</button>
            <button className="btn btn-secondary" onClick={handleExportZip} disabled={!!busy}><Package size={16} /> {busy === 'zip' ? 'Export...' : 'Exporter ZIP par période'}</button>
            <button className="btn btn-secondary" onClick={handleExportToFolder} disabled={!!busy}><FolderInput size={16} /> {busy === 'folder' ? 'Préparation...' : 'Préparer dans dossier Sage'}</button>
          </div>
          {folderResult && <div className="alert alert-success" style={{ marginTop: 14, fontSize: 13 }}>Fichier préparé : <code>{folderResult.path}</code></div>}
          <div className="sage-note">Import Sage : <strong>Fichier → Importer → Format paramétrable</strong>, choisir ton modèle <code>.MAE</code>, puis le TXT généré.</div>
        </div>
      </div>

      <div className="card glass-card" style={{ marginTop: 20 }}>
        <div className="section-heading"><h3>Mapping .MAE</h3><span>ordre exact des colonnes</span></div>
        <div className="mapping-grid">
          {mapping?.mapping?.map((item) => <div key={item} className="mapping-pill"><CheckCircle size={14} /> {item}</div>)}
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 20 }}>
        <div className="card glass-card">
          <div className="section-heading"><h3>Aperçu TXT généré</h3><span>{preview?.preview?.length || 0} lignes</span></div>
          {preview?.errors?.length > 0 && <div className="alert alert-error" style={{ marginBottom: 12 }}>{preview.errors.map((e, idx) => <div key={idx}>{e}</div>)}</div>}
          <pre className="code-preview">{(preview?.preview || mapping?.sample || []).join('\n')}</pre>
        </div>

        <div className="card glass-card">
          <div className="section-heading"><h3><History size={18} /> Historique Sage</h3><span>derniers exports</span></div>
          <div className="history-list">
            {history.map((h) => <div className="history-row" key={h.id}><div><strong>{h.filename}</strong><span>{new Date(h.created_at).toLocaleString()} · {h.invoice_count} facture(s)</span></div><b className={`badge badge-${h.status === 'failed' ? 'overdue' : 'paid'}`}>{h.status}</b></div>)}
            {history.length === 0 && <div className="empty-state compact">Aucun export enregistré.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }) { return <div className="info-tile"><span>{label}</span><strong>{value || '-'}</strong></div>; }
