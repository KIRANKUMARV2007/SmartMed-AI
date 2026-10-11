import { Search, Plus, X, Filter, AlertTriangle } from 'lucide-react';
import { useEquipment } from '../../context/EquipmentContext';

export default function FilterToolbar() {
  const {
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    selectedStatus,
    setSelectedStatus,
    selectedRoom,
    setSelectedRoom,
    showStaleOnly,
    setShowStaleOnly,
    resetFilters,
    setIsRegisterOpen,
    rooms,
    stats,
    staleThresholdHours,
  } = useEquipment();

  const categories = [
    'All',
    'Ventilator',
    'Defibrillator',
    'Infusion Pump',
    'Portable Ultrasound',
    'ECG Machine',
    'Patient Monitor',
    'Transport Wheelchair',
  ];

  const statuses = [
    'All',
    'Available',
    'Reserved',
    'In Use',
    'Sanitization Required',
    'Under Maintenance',
    'Faulty',
  ];

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedCategory !== 'All' ||
    selectedStatus !== 'All' ||
    selectedRoom !== 'All' ||
    showStaleOnly;

  return (
    <div className="toolbar-container">
      {/* Top Search & Primary Action Row */}
      <div className="toolbar-primary-row">
        {/* Search Field */}
        <div className="search-input-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search equipment by ID, model, category, or room..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search Equipment"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: 12, color: 'var(--text-muted)' }}
              title="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Category Selector */}
        <div className="toolbar-select-group">
          <select
            className="filter-select"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            aria-label="Filter by Category"
          >
            <option value="All">All Categories</option>
            {categories.filter((c) => c !== 'All').map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Room / Ward Selector */}
          <select
            className="filter-select"
            value={selectedRoom}
            onChange={(e) => setSelectedRoom(e.target.value)}
            aria-label="Filter by Room or Ward"
          >
            <option value="All">All Rooms / Wards</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.name}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        {/* Stale Filter Toggle Button */}
        <button
          type="button"
          className={`btn-stale-toggle ${showStaleOnly ? 'active' : ''}`}
          onClick={() => setShowStaleOnly(!showStaleOnly)}
          title={`Filter to show equipment not confirmed in the last ${staleThresholdHours} hours`}
        >
          <AlertTriangle size={15} />
          <span>Stale Only (&gt;{staleThresholdHours}h)</span>
          {stats.stale > 0 && (
            <span
              style={{
                background: showStaleOnly ? '#0b132b' : 'rgba(245, 158, 11, 0.3)',
                color: showStaleOnly ? '#fbbf24' : '#fbbf24',
                padding: '2px 6px',
                borderRadius: 'var(--radius-full)',
                fontSize: 11,
              }}
            >
              {stats.stale}
            </span>
          )}
        </button>

        {/* Reset Filters (if active) */}
        {hasActiveFilters && (
          <button
            type="button"
            className="btn-secondary"
            onClick={resetFilters}
            style={{ padding: '0 12px', height: '42px', fontSize: '12px' }}
            title="Reset all filters"
          >
            <Filter size={14} style={{ marginRight: 4 }} />
            Clear
          </button>
        )}

        {/* Register Equipment Primary Button */}
        <button
          type="button"
          className="btn-primary btn-register-equip"
          onClick={() => setIsRegisterOpen(true)}
        >
          <Plus size={18} />
          <span>Register Equipment</span>
        </button>
      </div>

      {/* Status Filter Pills Row */}
      <div className="status-pills-row">
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginRight: 4 }}>
          STATUS:
        </span>
        {statuses.map((s) => (
          <button
            key={s}
            type="button"
            className={`status-pill ${selectedStatus === s ? 'active' : ''}`}
            onClick={() => setSelectedStatus(s)}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
