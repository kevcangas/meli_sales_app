import React from 'react';
import { Award, Flame, ShieldCheck, AlertTriangle } from 'lucide-react';

export default function MetricsBar({ summary }) {
  const totalMonitored = summary?.total_best_sellers_monitored || 0;
  const withDeal = summary?.best_sellers_with_deal_count || 0;
  const realDeals = summary?.real_deals_count || 0;
  const illusoryDeals = summary?.illusory_deals_count || 0;

  return (
    <div className="metrics-grid">
      <div className="metric-card">
        <div className="metric-icon-box metric-icon-blue">
          <Award size={24} />
        </div>
        <div className="metric-data">
          <h4>Top Más Vendidos</h4>
          <div className="metric-number">{totalMonitored}</div>
          <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Artículos monitoreados</span>
        </div>
      </div>

      <div className="metric-card">
        <div className="metric-icon-box metric-icon-yellow">
          <Flame size={24} />
        </div>
        <div className="metric-data">
          <h4>Promociones Totales</h4>
          <div className="metric-number">{withDeal}</div>
          <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
            {totalMonitored > 0 ? `${Math.round((withDeal / totalMonitored) * 100)}% del catálogo` : '0%'}
          </span>
        </div>
      </div>

      <div className="metric-card">
        <div className="metric-icon-box metric-icon-green">
          <ShieldCheck size={24} />
        </div>
        <div className="metric-data">
          <h4>Descuentos Reales</h4>
          <div className="metric-number" style={{ color: '#059669' }}>{realDeals}</div>
          <span style={{ fontSize: '0.74rem', color: '#059669', fontWeight: 600 }}>
            Ofertas genuinas validadas
          </span>
        </div>
      </div>

      <div className="metric-card">
        <div className="metric-icon-box" style={{ background: '#fff1f2', color: '#e11d48' }}>
          <AlertTriangle size={24} />
        </div>
        <div className="metric-data">
          <h4>Descuentos Ilusorios</h4>
          <div className="metric-number" style={{ color: '#e11d48' }}>{illusoryDeals}</div>
          <span style={{ fontSize: '0.74rem', color: '#be123c', fontWeight: 600 }}>
            Precios ancla / inflados
          </span>
        </div>
      </div>
    </div>
  );
}
