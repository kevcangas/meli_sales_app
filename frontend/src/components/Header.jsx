import React from 'react';
import { RefreshCw, Upload, Zap, Clock, ShoppingBag, LineChart } from 'lucide-react';

export default function Header({ 
  onSync, 
  onOpenImport,
  isSyncing, 
  lastSyncAt, 
  executionTime, 
  activeTab, 
  onTabChange 
}) {
  const formatTime = (isoString) => {
    if (!isoString) return 'Nunca';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return isoString;
    }
  };

  return (
    <header className="app-header">
      <div className="brand-section">
        <div className="brand-logo">
          <Zap size={24} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <h1 className="brand-title">MELI DealRadar</h1>
            <span className="brand-badge">Sin API</span>
          </div>
          <p className="brand-subtitle">
            Cruce en tiempo real y econometría de mercado con TLS Chrome Impersonate
          </p>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="header-tabs">
        <button
          className={`tab-btn ${activeTab === 'radar' ? 'active' : ''}`}
          onClick={() => onTabChange('radar')}
        >
          <ShoppingBag size={16} />
          <span>Radar de Ofertas</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => onTabChange('analytics')}
        >
          <LineChart size={16} />
          <span>Análisis Econométrico</span>
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', color: '#64748b' }}>
          <Clock size={13} />
          <span>Última sync: {formatTime(lastSyncAt)}</span>
          {executionTime > 0 && <span>({executionTime}s)</span>}
        </div>

        <button
          type="button"
          onClick={onOpenImport}
          disabled={isSyncing}
          title="Importar una captura HTML guardada desde tu navegador"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '9px 14px',
            borderRadius: '10px',
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            color: '#334155',
            fontSize: '0.84rem',
            fontWeight: 600,
          }}
        >
          <Upload size={15} />
          <span>Importar HTML</span>
        </button>

        <button 
          className="sync-button" 
          onClick={onSync} 
          disabled={isSyncing}
          title="Ejecutar extracción y análisis en Mercado Libre"
        >
          <RefreshCw size={15} className={isSyncing ? "sync-spinner" : ""} />
          <span>{isSyncing ? "Sincronizando..." : "Sincronizar"}</span>
        </button>
      </div>
    </header>
  );
}
