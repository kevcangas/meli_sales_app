import React, { useMemo } from 'react';
import ProductCard from './ProductCard';
import { ShoppingBag, Layers } from 'lucide-react';

export default function ProductGrid({ products, isLoading, onViewHistory }) {
  // Agrupar productos por categoría
  const categoryGroups = useMemo(() => {
    if (!products || products.length === 0) return [];

    const map = new Map();
    products.forEach((product) => {
      const catKey = product.category_name || 'Otras Categorías';
      if (!map.has(catKey)) {
        map.set(catKey, {
          name: catKey,
          id: product.category_id || catKey.toLowerCase().replace(/\s+/g, '-'),
          items: [],
        });
      }
      map.get(catKey).items.push(product);
    });

    // Ordenar categorías por cantidad de artículos desc
    return Array.from(map.values()).sort((a, b) => b.items.length - a.items.length);
  }, [products]);

  const scrollToSection = (sectionId) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (isLoading) {
    return (
      <div className="product-grid">
        {[1, 2, 3, 4, 5, 6].map((idx) => (
          <div key={idx} className="product-card skeleton-card">
            <div style={{ height: '20px', background: '#f1f5f9', borderRadius: '4px', marginBottom: '14px', width: '40%' }}></div>
            <div style={{ height: '36px', background: '#f1f5f9', borderRadius: '4px', marginBottom: '16px' }}></div>
            <div style={{ height: '48px', background: '#f8fafc', borderRadius: '6px', marginTop: 'auto' }}></div>
          </div>
        ))}
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className="empty-state">
        <ShoppingBag size={42} style={{ color: '#94a3b8', margin: '0 auto 12px' }} />
        <h3>No se encontraron productos</h3>
        <p>Intenta ajustar los filtros de búsqueda o haz clic en "Sincronizar" para actualizar el catálogo.</p>
      </div>
    );
  }

  return (
    <div className="catalog-container">
      {/* Barra de acceso rápido por categoría (solo si hay más de 1 categoría) */}
      {categoryGroups.length > 1 && (
        <div className="category-quick-nav">
          <span className="quick-nav-label">
            <Layers size={13} />
            <span>Categorías:</span>
          </span>
          <div className="quick-nav-pills">
            {categoryGroups.map((group) => (
              <button
                key={group.id}
                onClick={() => scrollToSection(`cat-sec-${group.id}`)}
                className="quick-nav-btn"
              >
                <span>{group.name}</span>
                <span className="quick-nav-count">{group.items.length}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Secciones de Productos Separadas por Categoría */}
      <div className="category-sections-list">
        {categoryGroups.map((group) => {
          const dealCount = group.items.filter((p) => p.discount_percentage > 0).length;
          return (
            <section
              key={group.id}
              id={`cat-sec-${group.id}`}
              className="category-section"
            >
              <div className="category-section-header">
                <div className="category-section-title-wrap">
                  <h2 className="category-section-title">{group.name}</h2>
                  <div className="category-section-meta">
                    <span className="category-meta-pill">{group.items.length} productos</span>
                    {dealCount > 0 && (
                      <span className="category-meta-deals">
                        {dealCount} con rebaja
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="product-grid">
                {group.items.map((product, index) => (
                  <ProductCard
                    key={product.id || `${product.permalink}-${index}`}
                    product={product}
                    onViewHistory={onViewHistory}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
