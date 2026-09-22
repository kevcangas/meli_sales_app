import React, { useState } from 'react';
import { ExternalLink, Info, TrendingUp } from 'lucide-react';

export default function ProductCard({ product, onViewHistory }) {
  const [showDetail, setShowDetail] = useState(false);

  const formatMoney = (amount) => {
    if (amount === undefined || amount === null) return '$0';
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const hasDiscount = product.discount_percentage > 0;
  const isReal = product.deal_authenticity === 'REAL';
  const isIllusory = product.deal_authenticity === 'ILLUSORY';
  const isExaggerated = product.deal_authenticity === 'EXAGGERATED';

  const savings = product.original_price && product.original_price > product.current_price
    ? product.original_price - product.current_price
    : null;

  return (
    <div className="product-card">
      {/* Top Header: Rank + Discount + Authenticity Indicator */}
      <div className="card-header-minimal">
        <div className="card-header-left">
          {product.best_seller_rank && (
            <span className={`rank-badge-minimal ${product.best_seller_rank === 1 ? 'rank-first' : ''}`}>
              #{product.best_seller_rank}
            </span>
          )}
          {hasDiscount && (
            <span className="discount-tag-minimal">
              -{Math.round(product.discount_percentage)}%
            </span>
          )}
        </div>

        {hasDiscount && (
          <div className="card-header-right">
            {isReal && (
              <span className="auth-pill real" title={product.authenticity_reason || 'Descuento real comprobado'}>
                <span className="status-dot green" />
                Real
              </span>
            )}
            {isIllusory && (
              <span 
                className="auth-pill illusory" 
                title={product.authenticity_reason || 'Precio de lista inflado'}
                onClick={() => setShowDetail(!showDetail)}
                role="button"
                tabIndex={0}
              >
                <span className="status-dot red" />
                Precio inflado
              </span>
            )}
            {isExaggerated && (
              <span className="auth-pill mild" title={product.authenticity_reason || 'Rebaja menor a la publicada'}>
                <span className="status-dot amber" />
                Rebaja menor
              </span>
            )}
          </div>
        )}
      </div>

      {/* Title (2 lines max, legible) */}
      <h3 className="product-title-minimal" title={product.title}>
        {product.title}
      </h3>

      {/* Price Section */}
      <div className="price-block-minimal">
        <div className="price-row-minimal">
          <span className="current-price-minimal">
            {formatMoney(product.current_price)}
          </span>
          {product.original_price && product.original_price > product.current_price && (
            <span className="original-price-minimal">
              {formatMoney(product.original_price)}
            </span>
          )}
        </div>

        {savings && (
          <div className="savings-row-minimal">
            {isIllusory ? (
              <span className="savings-label illusory">
                Ahorro aparente (precio ancla)
              </span>
            ) : (
              <span className="savings-label real">
                Ahorras {formatMoney(savings)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Compact audit diagnosis */}
      {showDetail && product.authenticity_reason && (
        <div className="audit-detail-compact">
          <p>{product.authenticity_reason}</p>
        </div>
      )}

      {/* Footer Actions */}
      <div className="card-footer-minimal">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {onViewHistory && (
            <button
              onClick={() => onViewHistory(product.id)}
              className="history-trigger-btn"
              title="Ver gráfica de historial de precios"
            >
              <TrendingUp size={12} />
              <span>Historial</span>
            </button>
          )}

          <a
            href={product.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="link-minimal"
          >
            <span>Mercado Libre</span>
            <ExternalLink size={11} />
          </a>
        </div>

        {product.authenticity_reason && (
          <button
            onClick={() => setShowDetail(!showDetail)}
            className={`audit-info-btn ${showDetail ? 'active' : ''}`}
            title="Diagnóstico econométrico"
          >
            <Info size={13} />
          </button>
        )}
      </div>
    </div>
  );
}
