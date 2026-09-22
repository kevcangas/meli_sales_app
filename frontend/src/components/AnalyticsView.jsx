import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  BarChart3, 
  Scale, 
  Percent, 
  DollarSign, 
  Layers, 
  Sparkles, 
  ShieldCheck, 
  AlertTriangle,
  Trophy,
  ArrowRight
} from 'lucide-react';

export default function AnalyticsView({ categories, currentCategory, onCategoryChange }) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const catParam = currentCategory !== 'all' ? `?category_id=${currentCategory}` : '';
    fetch(`/api/v1/analytics${catParam}`)
      .then((res) => {
        if (!res.ok) throw new Error('Error al consultar métricas');
        return res.json();
      })
      .then((resData) => setData(resData))
      .catch((err) => console.error('Error fetching analytics:', err))
      .finally(() => setIsLoading(false));
  }, [currentCategory]);

  const formatMoney = (val) => {
    if (val === undefined || val === null) return '$0';
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      maximumFractionDigits: 0
    }).format(val);
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <p style={{ color: '#64748b' }}>Calculando parámetros econométricos y rankings de categoría...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="empty-state">
        <Scale size={48} style={{ color: '#94a3b8', margin: '0 auto' }} />
        <h3>Sin datos estadísticos disponibles</h3>
        <p>Ejecuta una sincronización para recopilar los precios de Mercado Libre.</p>
      </div>
    );
  }

  const {
    sample_size,
    central_tendency,
    dispersion,
    quantiles,
    promotions_and_savings,
    econometric_correlations,
    price_histogram,
    discount_brackets,
    market_insights,
    top_selling_category,
    category_rankings
  } = data;

  // Render Boxplot SVG
  const renderBoxplot = () => {
    if (!quantiles || quantiles.max === quantiles.min) return null;
    const { min, q1, median, q3, max } = quantiles;
    const width = 580;
    const height = 110;
    const padding = 50;

    const useLog = max / (min || 1) > 25;
    const scale = (val) => {
      const v = Math.max(min, Math.min(max, val));
      if (useLog) {
        const logMin = Math.log10(Math.max(1, min));
        const logMax = Math.log10(Math.max(1, max));
        const logVal = Math.log10(Math.max(1, v));
        return padding + ((logVal - logMin) / (logMax - logMin)) * (width - 2 * padding);
      }
      return padding + ((v - min) / (max - min)) * (width - 2 * padding);
    };

    const xMin = scale(min);
    const xQ1 = scale(q1);
    const xMed = scale(median);
    const xQ3 = scale(q3);
    const xMax = scale(max);

    return (
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
        <line x1={padding} y1={55} x2={width - padding} y2={55} stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 4" />
        <line x1={xMin} y1={55} x2={xQ1} y2={55} stroke="#64748b" strokeWidth="2" />
        <line x1={xQ3} y1={55} x2={xMax} y2={55} stroke="#64748b" strokeWidth="2" />
        <line x1={xMin} y1={42} x2={xMin} y2={68} stroke="#64748b" strokeWidth="2" />
        <line x1={xMax} y1={42} x2={xMax} y2={68} stroke="#64748b" strokeWidth="2" />
        <rect
          x={xQ1}
          y={35}
          width={Math.max(4, xQ3 - xQ1)}
          height={40}
          fill="#eff6ff"
          stroke="#3b82f6"
          strokeWidth="2"
          rx="4"
        />
        <line x1={xMed} y1={33} x2={xMed} y2={77} stroke="#2563eb" strokeWidth="3" />
        <text x={xMin} y={30} fontSize="11" textAnchor="middle" fill="#64748b" fontWeight="600">
          Min: {formatMoney(min)}
        </text>
        <text x={xQ1} y={92} fontSize="11" textAnchor="middle" fill="#3b82f6" fontWeight="600">
          Q1: {formatMoney(q1)}
        </text>
        <text x={xMed} y={20} fontSize="12" textAnchor="middle" fill="#1d4ed8" fontWeight="800">
          Mediana: {formatMoney(median)}
        </text>
        <text x={xQ3} y={92} fontSize="11" textAnchor="middle" fill="#3b82f6" fontWeight="600">
          Q3: {formatMoney(q3)}
        </text>
        <text x={xMax} y={30} fontSize="11" textAnchor="middle" fill="#64748b" fontWeight="600">
          Max: {formatMoney(max)}
        </text>
      </svg>
    );
  };

  return (
    <div className="analytics-container">
      {/* Hero Banner: Categoría Más Vendida */}
      {top_selling_category && (
        <div style={{
          background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
          border: '1px solid #fde68a',
          borderRadius: '16px',
          padding: '24px 28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px',
          boxShadow: '0 4px 16px rgba(245, 158, 11, 0.15)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
            <div style={{
              width: '56px',
              height: '56px',
              background: '#f59e0b',
              color: '#ffffff',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.35)',
              flexShrink: 0
            }}>
              <Trophy size={30} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  background: '#d97706',
                  color: '#ffffff',
                  padding: '3px 10px',
                  borderRadius: '999px'
                }}>
                  🏆 Categoría #1 Más Vendida
                </span>
                <span style={{ fontSize: '0.82rem', color: '#92400e', fontWeight: 600 }}>
                  Líder en presencia del Top de Mercado Libre
                </span>
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#78350f', marginTop: '4px', letterSpacing: '-0.02em' }}>
                {top_selling_category.category_name}
              </h2>
              <p style={{ fontSize: '0.88rem', color: '#92400e', marginTop: '3px', maxWidth: '680px', lineHeight: 1.45 }}>
                {top_selling_category.analysis}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.85)', padding: '10px 16px', borderRadius: '10px', border: '1px solid #fde68a', textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: '#92400e', fontWeight: 700, textTransform: 'uppercase' }}>Cuota del Top</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#78350f' }}>{top_selling_category.market_share_percentage}%</div>
            </div>
            <div style={{ background: 'rgba(255, 255, 255, 0.85)', padding: '10px 16px', borderRadius: '10px', border: '1px solid #fde68a', textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: '#92400e', fontWeight: 700, textTransform: 'uppercase' }}>Artículos Líderes</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#78350f' }}>{top_selling_category.items_count}</div>
            </div>
            <div style={{ background: 'rgba(255, 255, 255, 0.85)', padding: '10px 16px', borderRadius: '10px', border: '1px solid #fde68a', textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: '#92400e', fontWeight: 700, textTransform: 'uppercase' }}>Precio Mediano</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#78350f' }}>{formatMoney(top_selling_category.median_price)}</div>
            </div>
            <div style={{ background: 'rgba(255, 255, 255, 0.85)', padding: '10px 16px', borderRadius: '10px', border: '1px solid #fde68a', textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: '#92400e', fontWeight: 700, textTransform: 'uppercase' }}>Tasa de Oferta</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#78350f' }}>{top_selling_category.discount_penetration}%</div>
            </div>
          </div>
        </div>
      )}

      {/* Header Analítico */}
      <div className="analytics-header-card">
        <div className="analytics-title-row">
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
              Diagnóstico Econométrico de Mercado
            </h2>
            <p style={{ fontSize: '0.86rem', color: '#64748b', marginTop: '2px' }}>
              Evaluación microeconómica de estructura de precios, concentración (Gini) y volatilidad (CV). Muestra: <strong>{sample_size} productos</strong>.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>Área de Estudio:</span>
            <select
              className="select-control"
              value={currentCategory}
              onChange={(e) => onCategoryChange(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Cuadro de Hallazgos Económicos */}
        {market_insights && (
          <div className="insights-box">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#15803d', fontWeight: 700, fontSize: '0.9rem' }}>
              <Sparkles size={16} />
              <span>Conclusiones Econométricas Automatizadas</span>
            </div>
            <div className="insights-list">
              {market_insights.findings.map((f, i) => (
                <div key={i} className="insight-item">
                  <span className="insight-tag">{f.tag}</span>
                  <p className="insight-detail">{f.detail}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Ranking Comparativo de Todas las Categorías */}
      {category_rankings && category_rankings.length > 0 && (
        <div className="chart-card">
          <div className="chart-card-title">
            <Trophy size={18} style={{ color: '#d97706' }} />
            <span>Ranking de Categorías por Presencia en el Top de Ventas</span>
          </div>
          <p className="chart-card-subtitle">
            Comparativa estructural de cuota de mercado en los rankings más vendidos, precios medianos y presión de descuento.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
            {category_rankings.map((cat) => (
              <div
                key={cat.category_id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: cat.rank === 1 ? '#fffbeb' : '#f8fafc',
                  border: `1px solid ${cat.rank === 1 ? '#fde68a' : '#e2e8f0'}`,
                  borderRadius: '10px',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '240px' }}>
                  <span style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: cat.rank === 1 ? '#f59e0b' : (cat.rank === 2 ? '#94a3b8' : (cat.rank === 3 ? '#b45309' : '#e2e8f0')),
                    color: cat.rank <= 3 ? '#ffffff' : '#475569',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '0.8rem'
                  }}>
                    {cat.rank}
                  </span>
                  <div>
                    <strong style={{ color: '#0f172a', fontSize: '0.92rem' }}>{cat.category_name}</strong>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {cat.items_count} artículos ({cat.market_share_percentage}% del Top)
                    </div>
                  </div>
                </div>

                {/* Barra de cuota de mercado */}
                <div style={{ flex: 1, minWidth: '160px', maxWidth: '300px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: '#64748b', marginBottom: '3px' }}>
                    <span>Presencia Top</span>
                    <strong>{cat.market_share_percentage}%</strong>
                  </div>
                  <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${cat.market_share_percentage * 3}%`, height: '100%', background: cat.rank === 1 ? '#f59e0b' : '#3b82f6', borderRadius: '4px' }} />
                  </div>
                </div>

                {/* Métricas breves */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.84rem' }}>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>Precio Mediano</span>
                    <strong style={{ color: '#0f172a' }}>{formatMoney(cat.median_price)}</strong>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>Tasa Oferta</span>
                    <strong style={{ color: '#059669' }}>{cat.discount_penetration}%</strong>
                  </div>

                  {cat.category_id !== 'general' && cat.category_id !== 'unknown' && (
                    <button
                      onClick={() => onCategoryChange(cat.category_id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '6px 12px',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        color: '#2563eb'
                      }}
                      title="Explorar análisis detallado de esta categoría"
                    >
                      <span>Analizar</span>
                      <ArrowRight size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards Estadísticos */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon-box metric-icon-blue">
            <DollarSign size={24} />
          </div>
          <div className="metric-data">
            <h4>Precio Mediano (P50)</h4>
            <div className="metric-number">{formatMoney(central_tendency.median_price)}</div>
            <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
              Media: {formatMoney(central_tendency.mean_price)} ({central_tendency.skewness_type})
            </span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-box metric-icon-yellow">
            <Scale size={24} />
          </div>
          <div className="metric-data">
            <h4>Coef. de Variación (CV)</h4>
            <div className="metric-number">{dispersion.coefficient_of_variation.toFixed(2)}</div>
            <span style={{ fontSize: '0.74rem', color: dispersion.coefficient_of_variation > 0.8 ? '#b45309' : '#059669', fontWeight: 600 }}>
              {dispersion.coefficient_of_variation > 0.8 ? 'Alta Dispersión / Heterogéneo' : 'Precios Homogéneos'}
            </span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-box metric-icon-purple">
            <Layers size={24} />
          </div>
          <div className="metric-data">
            <h4>Índice de Gini (Precios)</h4>
            <div className="metric-number">{dispersion.gini_index.toFixed(2)}</div>
            <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
              Escala 0 (Uniforme) a 1 (Concentrado)
            </span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-box metric-icon-green">
            <Percent size={24} />
          </div>
          <div className="metric-data">
            <h4>Tasa de Penetración</h4>
            <div className="metric-number">{promotions_and_savings.discount_penetration_rate}%</div>
            <span style={{ fontSize: '0.74rem', color: '#059669', fontWeight: 600 }}>
              {promotions_and_savings.discounted_items_count} de {sample_size} con rebaja activa
            </span>
          </div>
        </div>
      </div>

      {/* Gráficos Estadísticos */}
      <div className="charts-grid">
        {/* Boxplot & IQR */}
        <div className="chart-card">
          <div className="chart-card-title">
            <BarChart3 size={18} style={{ color: '#2563eb' }} />
            <span>Resumen de 5 Números & Rango Intercuartílico (IQR)</span>
          </div>
          <p className="chart-card-subtitle">
            El 50% central del mercado se concentra entre Q1 ({formatMoney(quantiles.q1)}) y Q3 ({formatMoney(quantiles.q3)}). IQR: {formatMoney(quantiles.iqr)}.
          </p>
          <div style={{ marginTop: '20px', padding: '10px 0' }}>
            {renderBoxplot()}
          </div>
        </div>

        {/* Tramos de Descuento */}
        <div className="chart-card">
          <div className="chart-card-title">
            <TrendingUp size={18} style={{ color: '#059669' }} />
            <span>Estructura de Descuento (Profundidad Promocional)</span>
          </div>
          <p className="chart-card-subtitle">
            Distribución de artículos según la agresividad de la oferta porcentual.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '14px' }}>
            {discount_brackets.map((b, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.84rem' }}>
                <span style={{ width: '120px', color: '#334155', fontWeight: 500 }}>{b.bracket}</span>
                <div style={{ flex: 1, height: '18px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                  <div 
                    style={{ 
                      width: `${b.percentage}%`, 
                      height: '100%', 
                      background: idx === 0 ? '#cbd5e1' : (idx > 2 ? '#059669' : '#10b981'),
                      borderRadius: '4px',
                      transition: 'width 0.4s ease'
                    }} 
                  />
                </div>
                <span style={{ width: '70px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                  {b.percentage}% ({b.count})
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Auditoría de Autenticidad de Descuentos */}
        <div className="chart-card">
          <div className="chart-card-title">
            <ShieldCheck size={18} style={{ color: '#059669' }} />
            <span>Auditoría de Integridad Promocional (Reales vs Ilusorios)</span>
          </div>
          <p className="chart-card-subtitle">
            Detección econométrica de inflación de precio de lista (*was-now pricing inflation*).
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '14px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', fontWeight: 600, marginBottom: '6px' }}>
                <span style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <ShieldCheck size={14} /> Descuentos Reales Verificados
                </span>
                <span style={{ color: '#0f172a' }}>
                  {promotions_and_savings.real_deals_rate_percentage}% ({promotions_and_savings.real_deals_count || 0})
                </span>
              </div>
              <div style={{ height: '12px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${promotions_and_savings.real_deals_rate_percentage}%`, height: '100%', background: '#059669', borderRadius: '4px' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', fontWeight: 600, marginBottom: '6px' }}>
                <span style={{ color: '#e11d48', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <AlertTriangle size={14} /> Descuentos Ilusorios (Precio Ancla Inflado)
                </span>
                <span style={{ color: '#0f172a' }}>
                  {promotions_and_savings.illusory_rate_percentage}% ({promotions_and_savings.illusory_deals_count || 0})
                </span>
              </div>
              <div style={{ height: '12px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${promotions_and_savings.illusory_rate_percentage}%`, height: '100%', background: '#e11d48', borderRadius: '4px' }} />
              </div>
            </div>

            <div style={{
              padding: '10px 12px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              fontSize: '0.78rem',
              color: '#475569',
              lineHeight: 1.4,
              marginTop: '4px'
            }}>
              <strong>Diagnóstico de Mercado:</strong> El {promotions_and_savings.illusory_rate_percentage}% de las promociones analizadas en este sector exhibe sobreprecio tachado artificial para simular rebajas drásticas que no corresponden al precio habitual de transacción.
            </div>
          </div>
        </div>
      </div>

      {/* Histograma de Precios */}
      <div className="chart-card">
        <div className="chart-card-title">
          <BarChart3 size={18} style={{ color: '#6366f1' }} />
          <span>Histograma de Frecuencia de Precios (Intervalos de Costo)</span>
        </div>
        <p className="chart-card-subtitle">
          Frecuencia de productos por tramo monetario. Evidencia la densidad en rangos accesibles vs tickets altos.
        </p>

        <div style={{ display: 'flex', alignItems: 'flex-end', height: '160px', gap: '16px', marginTop: '24px', paddingBottom: '30px', borderBottom: '1px solid #e2e8f0' }}>
          {price_histogram.map((bin, idx) => {
            const maxPct = Math.max(...price_histogram.map((p) => p.percentage), 1);
            const barHeight = Math.max(8, (bin.percentage / maxPct) * 110);
            return (
              <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  {bin.percentage}%
                </span>
                <div
                  style={{
                    width: '80%',
                    height: `${barHeight}px`,
                    background: 'linear-gradient(180deg, #6366f1 0%, #4f46e5 100%)',
                    borderRadius: '4px 4px 0 0',
                    transition: 'height 0.4s ease'
                  }}
                  title={`${bin.count} productos`}
                />
                <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                  {bin.range_label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabla Econométrica de Síntesis */}
      <div className="table-card">
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '14px', color: '#0f172a' }}>
          Tabla de Indicadores Econométricos
        </h3>
        <table className="stat-table">
          <thead>
            <tr>
              <th>Variable</th>
              <th>Símbolo</th>
              <th>Valor Observado</th>
              <th>Interpretación / Benchmark</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Categoría Líder de Ventas</td>
              <td className="math-symbol">Cat*</td>
              <td><strong>{top_selling_category?.category_name || 'N/A'}</strong></td>
              <td>{top_selling_category?.market_share_percentage}% de cuota en el Top</td>
            </tr>
            <tr>
              <td>Tamaño Muestral</td>
              <td className="math-symbol">N</td>
              <td><strong>{sample_size} productos</strong></td>
              <td>Catálogo auditado en el Top</td>
            </tr>
            <tr>
              <td>Media Aritmética</td>
              <td className="math-symbol">&mu;</td>
              <td><strong>{formatMoney(central_tendency.mean_price)}</strong></td>
              <td>Sensible a outliers y artículos premium</td>
            </tr>
            <tr>
              <td>Mediana (Percentil 50)</td>
              <td className="math-symbol">Me</td>
              <td><strong>{formatMoney(central_tendency.median_price)}</strong></td>
              <td>Punto medio real; 50% cuesta menos de este valor</td>
            </tr>
            <tr>
              <td>Desviación Estándar</td>
              <td className="math-symbol">&sigma;</td>
              <td><strong>{formatMoney(dispersion.std_deviation)}</strong></td>
              <td>Dispersión absoluta respecto a la media</td>
            </tr>
            <tr>
              <td>Coeficiente de Variación</td>
              <td className="math-symbol">CV = &sigma; / &mu;</td>
              <td><strong>{dispersion.coefficient_of_variation.toFixed(3)}</strong></td>
              <td>Volatilidad normalizada libre de escala ({dispersion.coefficient_of_variation > 0.8 ? 'Alta' : 'Baja'})</td>
            </tr>
            <tr>
              <td>Rango Intercuartílico</td>
              <td className="math-symbol">IQR = Q3 - Q1</td>
              <td><strong>{formatMoney(quantiles.iqr)}</strong></td>
              <td>Amplitud de precios del 50% representativo</td>
            </tr>
            <tr>
              <td>Coeficiente de Gini</td>
              <td className="math-symbol">G</td>
              <td><strong>{dispersion.gini_index.toFixed(3)}</strong></td>
              <td>Concentración de precios en catálogo (0 a 1)</td>
            </tr>
            <tr>
              <td>Excedente del Consumidor Total</td>
              <td className="math-symbol">&sum; &Delta;P</td>
              <td><strong>{formatMoney(promotions_and_savings.total_consumer_surplus)}</strong></td>
              <td>Ahorro económico agregado respecto al precio de lista</td>
            </tr>
            <tr>
              <td>Correlación Spearman (Rango vs Precio)</td>
              <td className="math-symbol">&rho;</td>
              <td><strong>{econometric_correlations.rank_price_spearman_rho.toFixed(2)}</strong></td>
              <td>{econometric_correlations.rank_price_spearman_rho < 0 ? 'Precios menores correlacionan con mejor ranking' : 'Ticket superior en puestos líderes'}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
