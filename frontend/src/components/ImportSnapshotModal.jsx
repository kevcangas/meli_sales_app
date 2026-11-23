import React, { useState, useEffect } from 'react';
import { X, Upload, Copy, Check, FileCode2, ExternalLink, AlertCircle } from 'lucide-react';
import { apiUrl, parseApiResponse } from '../api';

const CONSOLE_SNIPPET = 'copy(document.documentElement.outerHTML)';

export default function ImportSnapshotModal({ selectedCategory, onClose, onImportSuccess }) {
  const [bestSellersHtml, setBestSellersHtml] = useState('');
  const [dealsHtml, setDealsHtml] = useState('');
  const [bestSellersFileName, setBestSellersFileName] = useState('');
  const [dealsFileName, setDealsFileName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isSubmitting) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isSubmitting]);

  const handleFileUpload = (e, target) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      if (target === 'best_sellers') {
        setBestSellersHtml(content);
        setBestSellersFileName(file.name);
      } else {
        setDealsHtml(content);
        setDealsFileName(file.name);
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleCopySnippet = async () => {
    try {
      await navigator.clipboard.writeText(CONSOLE_SNIPPET);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('No se pudo copiar al portapapeles. Copia manualmente el comando.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!bestSellersHtml.trim()) {
      setError('Carga un archivo .html o pega el HTML de /mas-vendidos primero.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(apiUrl('/api/v1/import/html'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          best_sellers_html: bestSellersHtml,
          deals_html: dealsHtml.trim() ? dealsHtml : null,
          category_id: selectedCategory !== 'all' ? selectedCategory : null,
        }),
      });
      const result = await parseApiResponse(res);
      if (!res.ok) {
        throw new Error(result?.detail || `Error HTTP ${res.status} al importar HTML`);
      }
      onImportSuccess(result?.message || '¡Captura HTML importada con éxito!');
      onClose();
    } catch (err) {
      setError(err.message || 'No se pudo procesar la captura HTML.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={() => !isSubmitting && onClose()}>
      <div className="modal-card" style={{ maxWidth: '680px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ paddingRight: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span className="modal-badge-tag">Importación Local</span>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Sin API</span>
            </div>
            <h3 className="modal-product-title">Importar Captura HTML desde tu Navegador</h3>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="modal-close-btn"
            title="Cerrar ventana"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '12px 14px',
            fontSize: '0.82rem',
            color: '#475569',
            lineHeight: 1.5
          }}>
            <strong style={{ color: '#0f172a', display: 'block', marginBottom: '4px' }}>
              ¿Cómo capturar una página cuando Mercado Libre pide verificación al servidor?
            </strong>
            1. Abre{' '}
            <a
              href="https://www.mercadolibre.com.mx/mas-vendidos"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#2563eb', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}
            >
              mercadolibre.com.mx/mas-vendidos <ExternalLink size={11} />
            </a>{' '}
            en tu navegador normal.<br />
            2. Guarda la página (<strong>Ctrl+S → Página web, solo HTML</strong>) y súbela aquí, o abre DevTools (F12 → Consola) y ejecuta:
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
              <code style={{
                flex: 1,
                background: '#0f172a',
                color: '#e2e8f0',
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontFamily: 'monospace'
              }}>
                {CONSOLE_SNIPPET}
              </code>
              <button
                type="button"
                onClick={handleCopySnippet}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  color: '#334155'
                }}
              >
                {copied ? <Check size={13} color="#059669" /> : <Copy size={13} />}
                <span>{copied ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                padding: '10px 12px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                color: '#b91c1c',
                fontSize: '0.82rem'
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>{error}</span>
            </div>
          )}

          {/* Más Vendidos (Obligatorio) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f172a' }}>
                HTML de Más Vendidos <span style={{ color: '#e11d48' }}>*</span>
              </label>
              <label style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                borderRadius: '6px',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                color: '#1d4ed8',
                fontSize: '0.76rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}>
                <FileCode2 size={13} />
                <span>{bestSellersFileName || 'Cargar archivo .html'}</span>
                <input
                  type="file"
                  accept=".html,.htm,text/html"
                  onChange={(e) => handleFileUpload(e, 'best_sellers')}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
            <textarea
              rows={4}
              value={bestSellersHtml}
              onChange={(e) => {
                setBestSellersHtml(e.target.value);
                setBestSellersFileName('');
              }}
              placeholder="Pega aquí el HTML de /mas-vendidos o sube el archivo guardado..."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontFamily: 'monospace',
                fontSize: '0.76rem',
                resize: 'vertical',
                color: '#0f172a'
              }}
            />
            {bestSellersHtml && (
              <span style={{ fontSize: '0.74rem', color: '#059669', fontWeight: 600 }}>
                ✓ {(bestSellersHtml.length / 1024).toFixed(1)} KB listos para analizar
              </span>
            )}
          </div>

          {/* Ofertas (Opcional) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.84rem', fontWeight: 600, color: '#334155' }}>
                HTML de Ofertas <span style={{ color: '#64748b', fontWeight: 400 }}>(opcional, para cruce extra)</span>
              </label>
              <label style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                borderRadius: '6px',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                color: '#475569',
                fontSize: '0.76rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}>
                <FileCode2 size={13} />
                <span>{dealsFileName || 'Cargar archivo .html'}</span>
                <input
                  type="file"
                  accept=".html,.htm,text/html"
                  onChange={(e) => handleFileUpload(e, 'deals')}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
            <textarea
              rows={2}
              value={dealsHtml}
              onChange={(e) => {
                setDealsHtml(e.target.value);
                setDealsFileName('');
              }}
              placeholder="Opcional: pega o sube el HTML de /ofertas..."
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontFamily: 'monospace',
                fontSize: '0.76rem',
                resize: 'vertical',
                color: '#0f172a'
              }}
            />
          </div>

          <div className="modal-footer" style={{ paddingTop: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="modal-secondary-btn"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !bestSellersHtml.trim()}
              className="sync-button"
              style={{ opacity: isSubmitting || !bestSellersHtml.trim() ? 0.6 : 1 }}
            >
              <Upload size={15} />
              <span>{isSubmitting ? 'Procesando...' : 'Importar y Analizar'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
