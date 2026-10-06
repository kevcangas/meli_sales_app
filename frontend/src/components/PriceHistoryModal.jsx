import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  ExternalLink, 
  Clock, 
  Calendar, 
  AlertCircle 
} from 'lucide-react';
import { apiUrl } from '../api';

const TIME_FILTERS = [
  { id: 'all', label: 'Todo' },
  { id: '24h', label: '24h' },
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: '90d', label: '90D' },
];

export default function PriceHistoryModal({ itemId, onClose }) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [activePointIndex, setActivePointIndex] = useState(null);

  useEffect(() => {
    if (!itemId) return;
    setIsLoading(true);
    setError(null);

    fetch(apiUrl(`/api/v1/products/${encodeURIComponent(itemId)}/history`))
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

  // Filtrado temporal dinámico
  const filteredHistory = useMemo(() => {
    if (!data?.history || data.history.length === 0) return [];
    if (selectedFilter === 'all') return data.history;

    const timestamps = data.history
      .map((h) => new Date(h.recorded_at).getTime())
      .filter((t) => !isNaN(t));

    if (timestamps.length === 0) return data.history;

    const latestTimestamp = Math.max(...timestamps);
    // Si la última observación ocurrió en los últimos 7 días con respecto a la fecha actual,
    // calculamos la ventana contra Date.now(); de lo contrario anclamos contra el último timestamp observado.
    const baseTime = (Date.now() - latestTimestamp < 7 * 24 * 60 * 60 * 1000)
      ? Date.now()
      : latestTimestamp;

    let durationMs = 0;
    if (selectedFilter === '24h') durationMs = 24 * 60 * 60 * 1000;
    else if (selectedFilter === '7d') durationMs = 7 * 24 * 60 * 60 * 1000;
    else if (selectedFilter === '30d') durationMs = 30 * 24 * 60 * 60 * 1000;
    else if (selectedFilter === '90d') durationMs = 90 * 24 * 60 * 60 * 1000;

    const cutoff = baseTime - durationMs;
    return data.history.filter((h) => new Date(h.recorded_at).getTime() >= cutoff);
  }, [data, selectedFilter]);

  // Ajustar punto activo cuando cambia el filtro
  useEffect(() => {
    if (filteredHistory.length > 0) {
      if (activePointIndex === null || activePointIndex >= filteredHistory.length) {
        setActivePointIndex(filteredHistory.length - 1);
      }
    } else {
      setActivePointIndex(null);
    }
  }, [filteredHistory]);

  // Estadísticas reactivas al filtro de tiempo
  const stats = useMemo(() => {
    if (!data) return null;
    if (filteredHistory.length === 0) {
      return {
        currentPrice: data.current_price,
        minPrice: data.min_recorded_price,
        maxPrice: data.max_recorded_price,
        trend: data.trend,
        priceChangePct: data.price_change_percentage,
        count: 0,
      };
    }

    const prices = filteredHistory.map((h) => h.current_price);
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const firstP = prices[0];
    const lastP = prices[prices.length - 1];
    const changePct = firstP > 0 ? Math.round(((lastP - firstP) / firstP) * 1000) / 10 : 0;
    let trend = 'stable';
    if (changePct <= -2.0) trend = 'downward';
    else if (changePct >= 2.0) trend = 'upward';

    return {
      currentPrice: lastP,
      minPrice: minP,
      maxPrice: maxP,
      trend,
      priceChangePct: changePct,
      count: filteredHistory.length,
    };
  }, [data, filteredHistory]);

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
    if (!data || !data.history) return null;

    if (filteredHistory.length === 0) {
      const activeLabel = TIME_FILTERS.find((f) => f.id === selectedFilter)?.label || selectedFilter;
      return (
        <div className="chart-empty-state">
          <AlertCircle size={28} className="empty-icon" />
          <p className="empty-text">
            No se registraron observaciones de precio para la ventana <strong>{activeLabel}</strong>.
          </p>
          <button
            type="button"
            className="empty-reset-btn"
            onClick={() => setSelectedFilter('all')}
          >
            Ver todo el histórico ({data.history.length} registros)
          </button>
        </div>
      );
    }

    const history = filteredHistory;
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

    const activePoint = (activePointIndex !== null && points[activePointIndex])
      ? points[activePointIndex]
      : points[points.length - 1];

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
            const showLabel = history.length <= 8 || idx === 0 || idx === history.length - 1 || idx % Math.ceil(history.length / 5) === 0 || isHovered;

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
                {showLabel && (
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
                )}
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
            {/* Resumen Estadístico Reactivo al Período */}
            <div className="modal-stats-grid">
              <div className="modal-stat-box">
                <span className="stat-box-label">
                  {selectedFilter === 'all' ? 'Precio Actual' : 'Último Precio'}
                </span>
                <span className="stat-box-val highlight">
                  {formatMoney(stats?.currentPrice)}
                </span>
              </div>
              <div className="modal-stat-box">
                <span className="stat-box-label">
                  {selectedFilter === 'all' ? 'Mínimo Histórico' : 'Mínimo Período'}
                </span>
                <span className="stat-box-val" style={{ color: '#059669' }}>
                  {formatMoney(stats?.minPrice)}
                </span>
              </div>
              <div className="modal-stat-box">
                <span className="stat-box-label">
                  {selectedFilter === 'all' ? 'Máximo Observado' : 'Máximo Período'}
                </span>
                <span className="stat-box-val" style={{ color: '#64748b' }}>
                  {formatMoney(stats?.maxPrice)}
                </span>
              </div>
              <div className="modal-stat-box">
                <span className="stat-box-label">
                  Tendencia {selectedFilter === 'all' ? 'Global' : 'Período'}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                  {stats?.trend === 'downward' && <TrendingDown size={14} style={{ color: '#059669' }} />}
                  {stats?.trend === 'upward' && <TrendingUp size={14} style={{ color: '#e11d48' }} />}
                  {stats?.trend === 'stable' && <Minus size={14} style={{ color: '#64748b' }} />}
                  <span style={{
                    fontSize: '0.86rem',
                    fontWeight: 700,
                    color: stats?.trend === 'downward' ? '#059669' : (stats?.trend === 'upward' ? '#e11d48' : '#64748b')
                  }}>
                    {stats?.priceChangePct > 0 ? `+${stats?.priceChangePct}%` : `${stats?.priceChangePct}%`}
                  </span>
                </div>
              </div>
            </div>

            {/* Gráfica de Serie Temporal con Filtro de Período */}
            <div className="chart-section-wrapper">
              <div className="chart-header-row">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#1e293b' }}>
                      Curva de Fluctuación de Precio
                    </span>
                    <span className="chart-filter-tag">
                      {TIME_FILTERS.find((f) => f.id === selectedFilter)?.label}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.74rem', color: '#64748b', display: 'block', marginTop: '2px' }}>
                    {filteredHistory.length} de {data.total_observations} sincronizaciones observadas
                  </span>
                </div>

                {/* Filtro de tiempo con botones pills */}
                <div className="time-filter-pills" role="group" aria-label="Filtro de período de tiempo">
                  {TIME_FILTERS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className={`time-filter-pill ${selectedFilter === f.id ? 'active' : ''}`}
                      onClick={() => setSelectedFilter(f.id)}
                      title={`Filtrar por ${f.label}`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {renderChart()}
            </div>

            {/* Histórico tabular compacto filtrado */}
            <div style={{ marginTop: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Registro Cronológico de Ejecuciones
                </span>
                <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                  {filteredHistory.length} registros en vista
                </span>
              </div>

              {filteredHistory.length > 0 ? (
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
                      {filteredHistory.map((h, i) => (
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
              ) : (
                <div className="chart-empty-state" style={{ padding: '24px 16px' }}>
                  <p className="empty-text" style={{ margin: 0 }}>
                    No hay registros cronológicos dentro del rango de tiempo seleccionado.
                  </p>
                </div>
              )}
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
