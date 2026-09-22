import React from 'react';
import { Search, Flame, ArrowUpDown, ShieldCheck } from 'lucide-react';

export default function FilterControls({
  categories,
  selectedCategory,
  onCategoryChange,
  searchTerm,
  onSearchChange,
  minDiscount,
  onMinDiscountChange,
  onlyDeals,
  onOnlyDealsToggle,
  authenticityFilter,
  onAuthenticityFilterChange,
  sortBy,
  onSortChange,
}) {
  return (
    <div className="filter-bar">
      <div className="filter-left">
        {/* Buscador de texto */}
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Buscar por producto, marca o modelo..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        {/* Selector de Categoría */}
        <select
          className="select-control"
          value={selectedCategory}
          onChange={(e) => onCategoryChange(e.target.value)}
        >
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>

        {/* Filtro de Autenticidad */}
        <select
          className="select-control"
          value={authenticityFilter}
          onChange={(e) => onAuthenticityFilterChange(e.target.value)}
          style={{
            borderColor: authenticityFilter === 'real' ? '#10b981' : (authenticityFilter === 'illusory' ? '#f43f5e' : undefined),
            color: authenticityFilter === 'real' ? '#047857' : (authenticityFilter === 'illusory' ? '#be123c' : undefined),
            fontWeight: authenticityFilter !== 'all' ? 700 : 500
          }}
        >
          <option value="all">Todas las ofertas</option>
          <option value="real">🟢 Solo Descuentos Reales</option>
          <option value="illusory">🔴 Solo Descuentos Ilusorios</option>
        </select>

        {/* Selector de Descuento Mínimo */}
        <select
          className="select-control"
          value={minDiscount}
          onChange={(e) => onMinDiscountChange(Number(e.target.value))}
        >
          <option value={0}>Cualquier % descuento</option>
          <option value={15}>Mínimo 15% OFF</option>
          <option value={25}>Mínimo 25% OFF</option>
          <option value={40}>Mínimo 40% OFF</option>
        </select>

        {/* Toggle Solo con Rebaja */}
        <button
          className={`toggle-button ${onlyDeals ? 'active' : ''}`}
          onClick={onOnlyDealsToggle}
          title="Mostrar únicamente productos que tienen rebaja activa"
        >
          <Flame size={14} />
          <span>Solo con Oferta</span>
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#64748b', fontSize: '0.84rem' }}>
          <ArrowUpDown size={13} />
          <span>Ordenar:</span>
        </div>
        <select
          className="select-control"
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value)}
        >
          <option value="discount_desc">Mayor descuento primero</option>
          <option value="authenticity_desc">Mayor autenticidad (Reales primero)</option>
          <option value="rank_asc">Ranking más vendido (#1 a #50)</option>
          <option value="price_asc">Menor precio</option>
          <option value="price_desc">Mayor precio</option>
        </select>
      </div>
    </div>
  );
}
