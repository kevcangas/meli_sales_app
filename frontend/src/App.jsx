import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Header from './components/Header';
import MetricsBar from './components/MetricsBar';
import FilterControls from './components/FilterControls';
import ProductGrid from './components/ProductGrid';
import AnalyticsView from './components/AnalyticsView';
import PriceHistoryModal from './components/PriceHistoryModal';
import ImportSnapshotModal from './components/ImportSnapshotModal';
import { apiUrl, parseApiResponse } from './api';

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
  const [showImportModal, setShowImportModal] = useState(false);

  const [comparisonData, setComparisonData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncVersion, setSyncVersion] = useState(0);
  const [statusBanner, setStatusBanner] = useState(null); // { type: 'info' | 'success' | 'error', text: string }

  // Cargar categorías disponibles
  useEffect(() => {
    fetch(apiUrl('/api/v1/categories'))
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return parseApiResponse(res);
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setCategories(data);
        }
      })
      .catch((err) => console.error('Error cargando categorías:', err));
  }, [syncVersion]);

  // Cargar datos de comparación desde el backend
  const loadComparison = useCallback(async (category = selectedCategory) => {
    setIsLoading(true);
    try {
      const catParam = category !== 'all' ? `?category_id=${encodeURIComponent(category)}` : '';
      const res = await fetch(apiUrl(`/api/v1/comparison${catParam}`));
      const data = await parseApiResponse(res);
      if (!res.ok) {
        throw new Error(data?.detail || `Error HTTP ${res.status} al cargar comparación`);
      }
      setComparisonData(data);
    } catch (err) {
      console.error('Error cargando datos de comparación:', err);
      setStatusBanner({
        type: 'error',
        text: `No se pudieron cargar los datos (${err.message}). Verifica que el backend esté activo.`,
      });
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
    setStatusBanner({ type: 'info', text: 'Iniciando extracción en tiempo real...' });
    let shouldAutoDismiss = true;
    try {
      const catParam = selectedCategory !== 'all' ? `?category_id=${encodeURIComponent(selectedCategory)}` : '';
      const endpoint = `/api/v1/sync${catParam}`;
      const res = await fetch(apiUrl(endpoint), { method: 'POST' });
      const result = await parseApiResponse(res);

      if (res.ok) {
        setStatusBanner({
          type: 'success',
          text: result?.message || '¡Datos actualizados con éxito!',
        });
        setSyncVersion((v) => v + 1);
        await loadComparison(selectedCategory);
      } else {
        shouldAutoDismiss = false;
        const detail = result?.detail ? ` — ${result.detail}` : '';
        setStatusBanner({
          type: 'error',
          text: `Error ${res.status} en ${endpoint}${detail}`,
        });
      }
    } catch (err) {
      shouldAutoDismiss = false;
      console.error('Error al sincronizar:', err);
      setStatusBanner({
        type: 'error',
        text: `Fallo al conectar con el servidor (${err.message}).`,
      });
    } finally {
      setIsSyncing(false);
      if (shouldAutoDismiss) {
        setTimeout(() => setStatusBanner(null), 4000);
      }
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
        onOpenImport={() => setShowImportModal(true)}
        isSyncing={isSyncing}
        lastSyncAt={comparisonData?.summary?.last_sync_at}
        executionTime={comparisonData?.summary?.execution_time_seconds}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {statusBanner && (
        <div
          role={statusBanner.type === 'error' ? 'alert' : 'status'}
          style={{
            padding: '12px 18px',
            background: statusBanner.type === 'error' ? '#fef2f2' : (statusBanner.type === 'success' ? '#ecfdf5' : '#eff6ff'),
            border: `1px solid ${statusBanner.type === 'error' ? '#fecaca' : (statusBanner.type === 'success' ? '#a7f3d0' : '#bfdbfe')}`,
            borderRadius: '8px',
            marginBottom: '20px',
            color: statusBanner.type === 'error' ? '#b91c1c' : (statusBanner.type === 'success' ? '#047857' : '#1e40af'),
            fontSize: '0.88rem',
            fontWeight: 500,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <span>{statusBanner.text}</span>
          <button
            onClick={() => setStatusBanner(null)}
            style={{ background: 'transparent', color: 'inherit', fontSize: '1.2rem', lineHeight: 1 }}
            aria-label="Cerrar aviso"
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
          syncVersion={syncVersion}
        />
      )}

      {/* Modal de Historial de Precios */}
      {historyModalItemId && (
        <PriceHistoryModal
          itemId={historyModalItemId}
          onClose={() => setHistoryModalItemId(null)}
        />
      )}

      {/* Modal de Importación de Captura HTML */}
      {showImportModal && (
        <ImportSnapshotModal
          selectedCategory={selectedCategory}
          onClose={() => setShowImportModal(false)}
          onImportSuccess={async (msg) => {
            setStatusBanner({ type: 'success', text: msg });
            setSyncVersion((v) => v + 1);
            await loadComparison(selectedCategory);
            setTimeout(() => setStatusBanner(null), 5000);
          }}
        />
      )}
    </div>
  );
}
