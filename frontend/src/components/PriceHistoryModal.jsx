import React, { useState, useEffect } from 'react';
import { 
  X, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  ExternalLink, 
  Clock, 
  DollarSign, 
  Calendar, 
  AlertCircle 
} from 'lucide-react';

export default function PriceHistoryModal({ itemId, onClose }) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activePointIndex, setActivePointIndex] = useState(null);

  useEffect(() => {
    if (!itemId) return;
    setIsLoading(true);
    setError(null);

    fetch(`/api/v1/products/${encodeURIComponent(itemId)}/history`)
      .then((res) => {
        if (!res.ok) throw new Error('No se pudo cargar el historial');
        return res.json();
      })
      .then((historyData) => {
        setData(historyData);
        if (historyData?.history?.length > 0) {
          setActivePointIndex(historyData.history.length - 1);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [itemId]);

  const formatMoney = (amount) => {
    if (amount === undefined || amount === null) return '$0';
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (isoString) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleString('es-MX', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  // Render SVG Chart
  const renderChart = () => {
    if (!data || !data.history || data.history.length === 0) return null;
    const history = data.history;

    const width = 560;
    const height = 180;
    const padX = 45;
    const padY = 30;

    const prices = history.map((h) => h.current_price);
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);

    // Evitar división por cero si todos los precios son idénticos
    const rangeP = maxP - minP > 0 ? maxP - minP : maxP * 0.1 || 10;
    const plotMin = Math.max(0, minP - rangeP * 0.15);
    const plotMax = maxP + rangeP * 0.15;

    const getX = (index) => {
      if (history.length === 1) return width / 2;
      return padX + (index / (history.length - 1)) * (width - 2 * padX);
    };

    const getY = (val) => {
      return height - padY - ((val - plotMin) / (plotMax - plotMin)) * (height - 2 * padY);
    };

    const points = history.map((h, i) => ({
      x: getX(i),
      y: getY(h.current_price),
      ...h,
    }));

    const pathD = points.reduce((acc, p, i) => {
      return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
    }, '');

    const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padY} L ${points[0].x} ${height - padY} Z`;

    const activePoint = activePointIndex !== null ? points[activePointIndex] : null;

    return (
      <div style={{ position: 'relative', marginTop: '16px' }}>
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          style={{ overflow: 'visible' }}
        >
          <defs>
            <linearGradient id="priceAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Líneas de cuadrícula horizontal */}
          <line
            x1={padX}
            y1={getY(maxP)}
            x2={width - padX}
            y2={getY(maxP)}
            stroke="#f1f5f9"
            strokeDasharray="4 4"
            strokeWidth="1"
          />
          <line
            x1={padX}
            y1={getY(minP)}
            x2={width - padX}
            y2={getY(minP)}
            stroke="#f1f5f9"
            strokeDasharray="4 4"
            strokeWidth="1"
          />

          {/* Etiquetas del eje Y */}
          <text x={padX - 8} y={getY(maxP) + 4} fontSize="10" textAnchor="end" fill="#94a3b8" fontWeight="600">
            {formatMoney(maxP)}
          </text>
          <text x={padX - 8} y={getY(minP) + 4} fontSize="10" textAnchor="end" fill="#94a3b8" fontWeight="600">
            {formatMoney(minP)}
          </text>

          {/* Área sombreada */}
          {history.length > 1 && (
            <path d={areaD} fill="url(#priceAreaGradient)" />
          )}

          {/* Línea de precio */}
          {history.length > 1 ? (
            <path
              d={pathD}
              fill="none"
              stroke="#2563eb"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : (
            <line
              x1={padX}
              y1={points[0].y}
              x2={width - padX}
              y2={points[0].y}
              stroke="#2563eb"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
          )}

          {/* Puntos interactivos */}
          {points.map((p, idx) => {
            const isHovered = activePointIndex === idx;
            return (
              <g key={idx} style={{ cursor: 'pointer' }} onClick={() => setActivePointIndex(idx)}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? 6 : 4}
                  fill={isHovered ? '#1d4ed8' : '#ffffff'}
                  stroke="#2563eb"
                  strokeWidth={isHovered ? 3 : 2}
                  style={{ transition: 'all 0.15s ease' }}
                />
                <text
                  x={p.x}
                  y={height - 10}
                  fontSize="9.5"
                  textAnchor="middle"
                  fill={isHovered ? '#0f172a' : '#94a3b8'}
                  fontWeight={isHovered ? 700 : 500}
                >
                  {formatDate(p.recorded_at).split(',')[0]}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Tooltip de punto activo */}
        {activePoint && (
          <div className="chart-tooltip-bubble">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                {formatDate(activePoint.recorded_at)} (Sync #{activePoint.sync_id})
              </span>
              {activePoint.discount_percentage > 0 && (
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#059669', background: '#ecfdf5', padding: '1px 5px', borderRadius: '4px' }}>
                  -{Math.round(activePoint.discount_percentage)}% OFF
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '2px' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                {formatMoney(activePoint.current_price)}
              </span>
              {activePoint.original_price && activePoint.original_price > activePoint.current_price && (
                <span style={{ fontSize: '0.82rem', color: '#94a3b8', textDecoration: 'line-through' }}>
                  {formatMoney(activePoint.original_price)}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ paddingRight: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span className="modal-badge-tag">
                {data?.category_name || 'Historial de Precios'}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                ID: {itemId}
              </span>
            </div>
            <h3 className="modal-product-title">
              {data?.title || 'Cargando producto...'}
            </h3>
          </div>
          <button onClick={onClose} className="modal-close-btn" title="Cerrar ventana">
            <X size={18} />
          </button>
        </div>

        {isLoading && (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
            <Clock size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <p>Recuperando serie temporal de precios...</p>
          </div>
        )}

        {error && (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#be123c' }}>
            <AlertCircle size={32} style={{ margin: '0 auto 12px' }} />
            <p>{error}</p>
          </div>
        )}

        {!isLoading && !error && data && (
          <div className="modal-body">
            {/* Resumen Estadístico */}
            <div className="modal-stats-grid">
              <div className="modal-stat-box">
                <span className="stat-box-label">Precio Actual</span>
                <span className="stat-box-val highlight">
                  {formatMoney(data.current_price)}
                </span>
              </div>
              <div className="modal-stat-box">
                <span className="stat-box-label">Mínimo Histórico</span>
                <span className="stat-box-val" style={{ color: '#059669' }}>
                  {formatMoney(data.min_recorded_price)}
                </span>
              </div>
              <div className="modal-stat-box">
                <span className="stat-box-label">Máximo Observado</span>
                <span className="stat-box-val" style={{ color: '#64748b' }}>
                  {formatMoney(data.max_recorded_price)}
                </span>
              </div>
              <div className="modal-stat-box">
                <span className="stat-box-label">Tendencia Temporal</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                  {data.trend === 'downward' && <TrendingDown size={14} style={{ color: '#059669' }} />}
                  {data.trend === 'upward' && <TrendingUp size={14} style={{ color: '#e11d48' }} />}
                  {data.trend === 'stable' && <Minus size={14} style={{ color: '#64748b' }} />}
                  <span style={{
                    fontSize: '0.86rem',
                    fontWeight: 700,
                    color: data.trend === 'downward' ? '#059669' : (data.trend === 'upward' ? '#e11d48' : '#64748b')
                  }}>
                    {data.price_change_percentage > 0 ? `+${data.price_change_percentage}%` : `${data.price_change_percentage}%`}
                  </span>
                </div>
              </div>
            </div>

            {/* Gráfica de Serie Temporal */}
            <div className="chart-section-wrapper">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#1e293b' }}>
                  Curva de Fluctuación de Precio (En cada sincronización)
                </span>
                <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
                  {data.total_observations} ejecuciones registradas
                </span>
              </div>

              {renderChart()}
            </div>

            {/* Histórico tabular compacto */}
            <div style={{ marginTop: '20px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Registro Cronológico de Ejecuciones
              </span>
              <div className="history-table-wrapper">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Sincronización</th>
                      <th>Fecha y Hora</th>
                      <th>Precio Cobrado</th>
                      <th>Precio Original</th>
                      <th>Rebaja</th>
                      <th>Ranking</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.history.map((h, i) => (
                      <tr 
                        key={i} 
                        className={activePointIndex === i ? 'active-row' : ''}
                        onClick={() => setActivePointIndex(i)}
                      >
                        <td><strong>#{h.sync_id}</strong></td>
                        <td>{formatDate(h.recorded_at)}</td>
                        <td><strong style={{ color: '#0f172a' }}>{formatMoney(h.current_price)}</strong></td>
                        <td>{h.original_price ? formatMoney(h.original_price) : '—'}</td>
                        <td>
                          {h.discount_percentage > 0 ? (
                            <span style={{ color: '#059669', fontWeight: 600 }}>
                              {Math.round(h.discount_percentage)}% OFF
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>Sin oferta</span>
                          )}
                        </td>
                        <td>{h.best_seller_rank ? `#${h.best_seller_rank}` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="modal-footer">
              <a
                href={data.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="modal-link-btn"
              >
                <span>Ver en Mercado Libre</span>
                <ExternalLink size={13} />
              </a>
              <button onClick={onClose} className="modal-secondary-btn">
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
