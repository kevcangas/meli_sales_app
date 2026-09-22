import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Header from './components/Header';
import MetricsBar from './components/MetricsBar';
import FilterControls from './components/FilterControls';
import ProductGrid from './components/ProductGrid';
import AnalyticsView from './components/AnalyticsView';
import PriceHistoryModal from './components/PriceHistoryModal';
import { apiUrl } from './api';

export default function App() {
  const [activeTab, setActiveTab] = useState('radar'); // 'radar' o 'analytics'
  const [categories, setCategories] = useState([
    { id: 'all', name: 'Todas las Categorías (General)', url_suffix: '' }
  ]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [minDiscount, setMinDiscount] = useState(0);
  const [onlyDeals, setOnlyDeals] = useState(false);
  const [authenticityFilter, setAuthenticityFilter] = useState('all'); // 'all', 'real', 'illusory'
  const [sortBy, setSortBy] = useState('discount_desc');
  const [historyModalItemId, setHistoryModalItemId] = useState(null);

  const [comparisonData, setComparisonData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // Cargar categorías disponibles
  useEffect(() => {
    fetch(apiUrl('/api/v1/categories'))
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCategories(data);
        }
      })
      .catch((err) => console.error('Error cargando categorías:', err));
  }, []);

  // Cargar datos de comparación desde el backend
  const loadComparison = useCallback(async (category = selectedCategory) => {
    setIsLoading(true);
    try {
      const catParam = category !== 'all' ? `?category_id=${category}` : '';
      const res = await fetch(apiUrl(`/api/v1/comparison${catParam}`));
      if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
      const data = await res.json();
      setComparisonData(data);
    } catch (err) {
      console.error('Error cargando datos de comparación:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    loadComparison(selectedCategory);
  }, [selectedCategory, loadComparison]);

  // Disparar sincronización manual
  const handleSync = async () => {
    setIsSyncing(true);
    setStatusMessage('Iniciando extracción en tiempo real...');
    try {
      const catParam = selectedCategory !== 'all' ? `?category_id=${selectedCategory}` : '';
      const res = await fetch(apiUrl(`/api/v1/sync${catParam}`), { method: 'POST' });
      const result = await res.json();

      if (res.ok) {
        setStatusMessage('¡Datos actualizados con éxito!');
        await loadComparison(selectedCategory);
      } else {
        setStatusMessage(`Aviso: ${result.detail || 'Error en sincronización'}`);
      }
    } catch (err) {
      console.error('Error al sincronizar:', err);
      setStatusMessage('Fallo al conectar con el servidor.');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  // Filtrado y ordenamiento en cliente
  const filteredProducts = useMemo(() => {
    if (!comparisonData || !comparisonData.best_sellers) return [];

    let list = [...comparisonData.best_sellers];

    // Filtro de solo ofertas
    if (onlyDeals) {
      list = list.filter((p) => p.is_match || p.discount_percentage > 0);
    }

    // Filtro de autenticidad (Reales vs Ilusorios)
    if (authenticityFilter === 'real') {
      list = list.filter((p) => p.deal_authenticity === 'REAL');
    } else if (authenticityFilter === 'illusory') {
      list = list.filter((p) => p.deal_authenticity === 'ILLUSORY');
    }

    // Filtro de descuento mínimo
    if (minDiscount > 0) {
      list = list.filter((p) => p.discount_percentage >= minDiscount);
    }

    // Filtro por término de búsqueda
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter((p) =>
        p.title.toLowerCase().includes(term) || (p.id && String(p.id).toLowerCase().includes(term))
      );
    }

    // Ordenamiento
    list.sort((a, b) => {
      if (sortBy === 'authenticity_desc') {
        return (b.authenticity_score || 0) - (a.authenticity_score || 0);
      }
      if (sortBy === 'discount_desc') {
        return (b.discount_percentage || 0) - (a.discount_percentage || 0);
      }
      if (sortBy === 'rank_asc') {
        return (a.best_seller_rank || 999) - (b.best_seller_rank || 999);
      }
      if (sortBy === 'price_asc') {
        return a.current_price - b.current_price;
      }
      if (sortBy === 'price_desc') {
        return b.current_price - a.current_price;
      }
      return 0;
    });

    return list;
  }, [comparisonData, onlyDeals, authenticityFilter, minDiscount, searchTerm, sortBy]);

  return (
    <div className="app-layout">
      <Header
        onSync={handleSync}
        isSyncing={isSyncing}
        lastSyncAt={comparisonData?.summary?.last_sync_at}
        executionTime={comparisonData?.summary?.execution_time_seconds}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {statusMessage && (
        <div style={{
          padding: '12px 18px',
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '8px',
          marginBottom: '20px',
          color: '#1e40af',
          fontSize: '0.88rem',
          fontWeight: 500,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{statusMessage}</span>
          <button 
            onClick={() => setStatusMessage(null)}
            style={{ background: 'transparent', color: '#64748b', fontSize: '1.2rem', lineHeight: 1 }}
          >
            &times;
          </button>
        </div>
      )}

      {activeTab === 'radar' ? (
        <>
          <MetricsBar
            summary={comparisonData?.summary}
          />

          <FilterControls
            categories={categories}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            minDiscount={minDiscount}
            onMinDiscountChange={setMinDiscount}
            onlyDeals={onlyDeals}
            onOnlyDealsToggle={() => setOnlyDeals(!onlyDeals)}
            authenticityFilter={authenticityFilter}
            onAuthenticityFilterChange={setAuthenticityFilter}
            sortBy={sortBy}
            onSortChange={setSortBy}
          />

          <ProductGrid
            products={filteredProducts}
            isLoading={isLoading}
            onViewHistory={(id) => setHistoryModalItemId(id)}
          />
        </>
      ) : (
        <AnalyticsView
          categories={categories}
          currentCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
        />
      )}

      {/* Modal de Historial de Precios */}
      {historyModalItemId && (
        <PriceHistoryModal
          itemId={historyModalItemId}
          onClose={() => setHistoryModalItemId(null)}
        />
      )}
    </div>
  );
}
