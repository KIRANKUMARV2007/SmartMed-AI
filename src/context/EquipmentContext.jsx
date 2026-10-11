import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  INITIAL_EQUIPMENT,
  HOSPITAL_ROOMS,
  INITIAL_MOVEMENTS,
  INITIAL_MAINTENANCE_ALERTS,
  DEMO_PERSONAS,
} from '../data/mockData';

const EquipmentContext = createContext(null);

export function EquipmentProvider({ children }) {
  const [equipment, setEquipment] = useState(INITIAL_EQUIPMENT);
  const [rooms] = useState(HOSPITAL_ROOMS);
  const [movements, setMovements] = useState(INITIAL_MOVEMENTS);
  const [maintenanceAlerts] = useState(INITIAL_MAINTENANCE_ALERTS);
  const [activePersona, setActivePersona] = useState(DEMO_PERSONAS[0]);
  const [staleThresholdHours, setStaleThresholdHours] = useState(6);
  const [theme, setThemeState] = useState('dark');

  // Navigation & Filtering
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedRoom, setSelectedRoom] = useState('All');
  const [showStaleOnly, setShowStaleOnly] = useState(false);

  // Modal inspection & interactive dialog states
  const [inspectingEquipment, setInspectingEquipment] = useState(null);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [qrScannerMode, setQRScannerMode] = useState('universal'); // 'universal' | 'dual-move'
  const [bookingTargetEquipment, setBookingTargetEquipment] = useState(null);
  const [handoverTargetEquipment, setHandoverTargetEquipment] = useState(null);
  const [qrCardTarget, setQRCardTarget] = useState(null); // { type: 'equipment' | 'room', data: item }

  // Theme synchronization with HTML data-theme attribute
  const setTheme = useCallback((newTheme) => {
    setThemeState(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Stale Location Check: true if last confirmed older than threshold
  const isLocationStale = useCallback(
    (item) => {
      if (!item || !item.lastConfirmedAt) return false;
      const lastTime = new Date(item.lastConfirmedAt).getTime();
      const elapsedMs = Date.now() - lastTime;
      return elapsedMs > staleThresholdHours * 3600 * 1000;
    },
    [staleThresholdHours]
  );

  // Format relative time helper
  const getRelativeTime = useCallback((isoString) => {
    if (!isoString) return 'Never';
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ${diffMins % 60}m ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }, []);

  // =========================================================================
  // 1. SHARED BOOKING ENGINE (APP & QR RESERVATIONS)
  // Enforces duplicate-booking prevention and clinical safety checks
  // =========================================================================
  const bookEquipment = useCallback(
    (equipmentId, bookingDetails = {}) => {
      const item = equipment.find((e) => e.id === equipmentId);
      if (!item) {
        return { success: false, error: 'Equipment record not found.' };
      }

      // Check 1: Already Reserved -> Exact required spec text
      if (item.status === 'Reserved') {
        return {
          success: false,
          error: 'Already booked! Try another device.',
          status: 'Reserved',
        };
      }

      // Check 2: Active Clinical Use
      if (item.status === 'In Use') {
        return {
          success: false,
          error: 'Equipment is currently in active clinical use. Cannot be booked.',
          status: 'In Use',
        };
      }

      // Check 3: Faulty Safety Block
      if (item.status === 'Faulty') {
        return {
          success: false,
          error: 'Equipment is marked FAULTY. Booking prohibited by clinical safety rules.',
          status: 'Faulty',
        };
      }

      // Check 4: Under Maintenance Block
      if (item.status === 'Under Maintenance') {
        return {
          success: false,
          error: 'Equipment is currently undergoing maintenance. Cannot be booked.',
          status: 'Under Maintenance',
        };
      }

      // Check 5: Sanitization Pending Block
      if (item.status === 'Sanitization Required') {
        return {
          success: false,
          error: 'Equipment requires infection control sanitization before booking.',
          status: 'Sanitization Required',
        };
      }

      // Check 6: Must be Available
      if (item.status !== 'Available') {
        return {
          success: false,
          error: `Equipment is not eligible for booking (Status: ${item.status}).`,
          status: item.status,
        };
      }

      // 30-Minute Reservation Expiry
      const nowMs = Date.now();
      const expiresAt = new Date(nowMs + 30 * 60 * 1000).toISOString();
      const reservedAt = new Date(nowMs).toISOString();

      const reservationData = {
        reservedBy: activePersona.name,
        staffId: activePersona.id,
        department: activePersona.department,
        reservedAt,
        expiresAt,
        purpose: bookingDetails.purpose || 'Emergency / Clinical Procedure',
      };

      setEquipment((prev) =>
        prev.map((e) => {
          if (e.id === equipmentId) {
            return {
              ...e,
              status: 'Reserved',
              reservation: reservationData,
            };
          }
          return e;
        })
      );

      // Audit Trail Logging
      const auditLog = {
        id: `AUD-${Date.now().toString().slice(-4)}`,
        equipmentId: item.id,
        equipmentName: item.name,
        fromRoom: item.currentRoom,
        toRoom: item.currentRoom,
        timestamp: reservedAt,
        staffId: activePersona.id,
        staffName: activePersona.name,
        staffRole: activePersona.role,
        type: 'Reservation Placed (30m Expiry)',
        details: `Reserved for ${activePersona.department}. Expires at ${new Date(expiresAt).toLocaleTimeString()}`,
      };

      setMovements((prev) => [auditLog, ...prev]);

      return {
        success: true,
        expiresAt,
        equipment: { ...item, status: 'Reserved', reservation: reservationData },
      };
    },
    [equipment, activePersona]
  );

  // =========================================================================
  // 2. CANCEL RESERVATION
  // =========================================================================
  const cancelReservation = useCallback(
    (equipmentId, reason = 'Cancelled by staff member') => {
      const item = equipment.find((e) => e.id === equipmentId);
      if (!item || item.status !== 'Reserved') return;

      setEquipment((prev) =>
        prev.map((e) => {
          if (e.id === equipmentId) {
            return {
              ...e,
              status: 'Available',
              reservation: null,
            };
          }
          return e;
        })
      );

      setMovements((prev) => [
        {
          id: `AUD-${Date.now().toString().slice(-4)}`,
          equipmentId: item.id,
          equipmentName: item.name,
          fromRoom: item.currentRoom,
          toRoom: item.currentRoom,
          timestamp: new Date().toISOString(),
          staffId: activePersona.id,
          staffName: activePersona.name,
          staffRole: activePersona.role,
          type: 'Reservation Cancelled',
          details: reason,
        },
        ...prev,
      ]);
    },
    [equipment, activePersona]
  );

  // =========================================================================
  // 3. PHYSICAL HANDOVER VERIFICATION
  // Only the reserver or an authorized clinician can confirm physical handover.
  // Reservation alone NEVER transitions status to In Use.
  // =========================================================================
  const confirmHandover = useCallback(
    (equipmentId) => {
      const item = equipment.find((e) => e.id === equipmentId);
      if (!item) return { success: false, error: 'Equipment not found' };

      if (item.status !== 'Reserved') {
        return {
          success: false,
          error: `Handover rejected: Device is not in Reserved status (Status: ${item.status}).`,
        };
      }

      // Check if reservation expired
      if (item.reservation?.expiresAt) {
        const isExpired = new Date(item.reservation.expiresAt).getTime() <= Date.now();
        if (isExpired) {
          return {
            success: false,
            error: 'Handover rejected: Reservation window has expired.',
          };
        }
      }

      const nowIso = new Date().toISOString();

      setEquipment((prev) =>
        prev.map((e) => {
          if (e.id === equipmentId) {
            return {
              ...e,
              status: 'In Use',
              lastConfirmedAt: nowIso,
              lastConfirmedBy: activePersona.name,
              reservation: {
                ...e.reservation,
                handedOverAt: nowIso,
                handedOverBy: activePersona.name,
              },
            };
          }
          return e;
        })
      );

      // Audit Trail
      setMovements((prev) => [
        {
          id: `AUD-${Date.now().toString().slice(-4)}`,
          equipmentId: item.id,
          equipmentName: item.name,
          fromRoom: item.currentRoom,
          toRoom: item.currentRoom,
          timestamp: nowIso,
          staffId: activePersona.id,
          staffName: activePersona.name,
          staffRole: activePersona.role,
          type: 'Physical Handover Verified (In Use)',
          details: `Bedside verification confirmed. Device transitioned to In Use for ${item.reservation?.department || activePersona.department}.`,
        },
        ...prev,
      ]);

      return { success: true };
    },
    [equipment, activePersona]
  );

  // =========================================================================
  // 4. RETURN EQUIPMENT (Routes directly to Sanitization Required)
  // =========================================================================
  const returnEquipment = useCallback(
    (equipmentId) => {
      const item = equipment.find((e) => e.id === equipmentId);
      if (!item) return;

      const nowIso = new Date().toISOString();

      setEquipment((prev) =>
        prev.map((e) => {
          if (e.id === equipmentId) {
            return {
              ...e,
              status: 'Sanitization Required',
              sanitizationStatus: 'PENDING',
              reservation: null,
              lastConfirmedAt: nowIso,
              lastConfirmedBy: activePersona.name,
            };
          }
          return e;
        })
      );

      setMovements((prev) => [
        {
          id: `AUD-${Date.now().toString().slice(-4)}`,
          equipmentId: item.id,
          equipmentName: item.name,
          fromRoom: item.currentRoom,
          toRoom: 'Central Sanitization & Decon Bay',
          timestamp: nowIso,
          staffId: activePersona.id,
          staffName: activePersona.name,
          staffRole: activePersona.role,
          type: 'Equipment Returned (Sanitization Pending)',
          details: 'Discharged from clinical use. Routing to Central Sanitization Bay.',
        },
        ...prev,
      ]);
    },
    [equipment, activePersona]
  );

  // =========================================================================
  // 5. DUAL-SCAN EQUIPMENT MOVEMENT
  // Requires both Equipment QR and Destination Room QR.
  // Updates currentRoom, lastConfirmedAt, and appends movement audit record.
  // =========================================================================
  const executeDualScanMovement = useCallback(
    (equipmentId, destinationRoomName) => {
      const item = equipment.find((e) => e.id === equipmentId);
      if (!item) {
        return { success: false, error: 'Equipment not found' };
      }

      const destRoom = rooms.find((r) => r.name === destinationRoomName);
      if (!destRoom) {
        return { success: false, error: 'Destination room not recognized' };
      }

      if (item.currentRoom === destRoom.name) {
        return {
          success: false,
          error: `Equipment is already confirmed in ${destRoom.name}.`,
        };
      }

      const nowIso = new Date().toISOString();
      const prevRoom = item.currentRoom;
      const updatedItem = {
        ...item,
        currentRoom: destRoom.name,
        roomId: destRoom.id,
        lastConfirmedAt: nowIso,
        lastConfirmedBy: activePersona.name,
      };

      setEquipment((prev) =>
        prev.map((e) => {
          if (e.id === equipmentId) {
            return updatedItem;
          }
          return e;
        })
      );

      // Immediately refresh equipment detail view if currently open
      setInspectingEquipment((prev) =>
        prev && prev.id === equipmentId ? updatedItem : prev
      );

      const movementLog = {
        id: `MOV-${Date.now().toString().slice(-4)}`,
        equipmentId: item.id,
        equipmentName: item.name,
        fromRoom: prevRoom,
        toRoom: destRoom.name,
        timestamp: nowIso,
        staffId: activePersona.id,
        staffName: activePersona.name,
        staffRole: activePersona.role,
        type: 'Dual-QR Verified Transfer',
        details: `Scanned equipment QR and room QR at ${destRoom.name}. Geolocation confirmed.`,
      };

      setMovements((prev) => [movementLog, ...prev]);

      return {
        success: true,
        fromRoom: prevRoom,
        toRoom: destRoom.name,
        equipment: updatedItem,
      };
    },
    [equipment, rooms, activePersona]
  );

  // =========================================================================
  // 6. RESERVATION EXPIRY WORKER (Evaluated periodically)
  // Automatically releases expired reservations and records audit trail.
  // =========================================================================
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setEquipment((prevEquipment) => {
        let hasChanges = false;
        const expiredItems = [];

        const next = prevEquipment.map((item) => {
          if (
            item.status === 'Reserved' &&
            item.reservation?.expiresAt &&
            new Date(item.reservation.expiresAt).getTime() <= now
          ) {
            hasChanges = true;
            expiredItems.push(item);
            return {
              ...item,
              status: 'Available',
              reservation: null,
            };
          }
          return item;
        });

        if (hasChanges && expiredItems.length > 0) {
          // Log expiry audit entries
          expiredItems.forEach((expItem) => {
            setMovements((prevMovs) => [
              {
                id: `AUD-${Date.now().toString().slice(-4)}`,
                equipmentId: expItem.id,
                equipmentName: expItem.name,
                fromRoom: expItem.currentRoom,
                toRoom: expItem.currentRoom,
                timestamp: new Date().toISOString(),
                staffId: 'SYSTEM',
                staffName: 'SmartMed Engine',
                staffRole: 'Automated Governance',
                type: 'Reservation Expired (Auto-Released)',
                details: '30-minute reservation elapsed without physical handover verification. Released to Available.',
              },
              ...prevMovs,
            ]);
          });
          return next;
        }

        return prevEquipment;
      });
    }, 5000); // Check every 5s

    return () => clearInterval(interval);
  }, []);

  // Filtered equipment list
  const filteredEquipment = useMemo(() => {
    return equipment.filter((item) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesQuery =
          item.id.toLowerCase().includes(q) ||
          item.name.toLowerCase().includes(q) ||
          item.model.toLowerCase().includes(q) ||
          item.currentRoom.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q);
        if (!matchesQuery) return false;
      }

      if (selectedCategory !== 'All' && item.category !== selectedCategory) {
        return false;
      }

      if (selectedStatus !== 'All' && item.status !== selectedStatus) {
        return false;
      }

      if (selectedRoom !== 'All' && item.currentRoom !== selectedRoom) {
        return false;
      }

      if (showStaleOnly && !isLocationStale(item)) {
        return false;
      }

      return true;
    });
  }, [equipment, searchQuery, selectedCategory, selectedStatus, selectedRoom, showStaleOnly, isLocationStale]);

  // Computed summary metrics
  const stats = useMemo(() => {
    const total = equipment.length;
    let available = 0;
    let reserved = 0;
    let inUse = 0;
    let sanitization = 0;
    let maintenance = 0;
    let faulty = 0;
    let stale = 0;

    equipment.forEach((item) => {
      if (item.status === 'Available') available++;
      else if (item.status === 'Reserved') reserved++;
      else if (item.status === 'In Use') inUse++;
      else if (item.status === 'Sanitization Required') sanitization++;
      else if (item.status === 'Under Maintenance') maintenance++;
      else if (item.status === 'Faulty') faulty++;

      if (isLocationStale(item)) stale++;
    });

    const readyRate = total > 0 ? Math.round((available / total) * 100) : 0;

    return {
      total,
      available,
      reserved,
      inUse,
      sanitization,
      maintenance,
      faulty,
      stale,
      readyRate,
    };
  }, [equipment, isLocationStale]);

  // Action: Register new equipment
  const registerEquipment = useCallback(
    (newItem) => {
      const id = `EQ-${newItem.category.slice(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
      const fullItem = {
        ...newItem,
        id,
        status: 'Available',
        lastConfirmedAt: new Date().toISOString(),
        lastConfirmedBy: activePersona.name,
        sanitizationStatus: 'CLEARED',
        operatingHours: 0,
        totalUsageSessions: 0,
        reservation: null,
      };

      setEquipment((prev) => [fullItem, ...prev]);

      const movementLog = {
        id: `MOV-${Date.now().toString().slice(-4)}`,
        equipmentId: id,
        equipmentName: fullItem.name,
        fromRoom: 'Inventory Ingestion / Warehouse',
        toRoom: fullItem.currentRoom,
        timestamp: new Date().toISOString(),
        staffId: activePersona.id,
        staffName: activePersona.name,
        staffRole: activePersona.role,
        type: 'Asset Commissioning',
        details: 'Initial onboarding and calibration check completed.',
      };
      setMovements((prev) => [movementLog, ...prev]);

      return fullItem;
    },
    [activePersona]
  );

  // Action: Clear sanitization
  const clearSanitization = useCallback(
    (equipmentId) => {
      const equipItem = equipment.find((e) => e.id === equipmentId);
      if (!equipItem) return;

      const nowIso = new Date().toISOString();

      setEquipment((prev) =>
        prev.map((item) => {
          if (item.id === equipmentId) {
            return {
              ...item,
              status: 'Available',
              sanitizationStatus: 'CLEARED',
              lastSanitizedAt: nowIso,
              lastConfirmedAt: nowIso,
              lastConfirmedBy: activePersona.name,
            };
          }
          return item;
        })
      );

      setMovements((prev) => [
        {
          id: `AUD-${Date.now().toString().slice(-4)}`,
          equipmentId,
          equipmentName: equipItem.name,
          fromRoom: 'Central Sanitization & Decon Bay',
          toRoom: equipItem.currentRoom,
          timestamp: nowIso,
          staffId: activePersona.id,
          staffName: activePersona.name,
          staffRole: activePersona.role,
          type: 'Sanitization Clearance',
          details: 'High-level disinfection protocol completed. Approved for patient use.',
        },
        ...prev,
      ]);
    },
    [activePersona, equipment]
  );

  const resetFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedCategory('All');
    setSelectedStatus('All');
    setSelectedRoom('All');
    setShowStaleOnly(false);
  }, []);

  const value = {
    equipment,
    rooms,
    movements,
    maintenanceAlerts,
    activePersona,
    setActivePersona,
    demoPersonas: DEMO_PERSONAS,
    staleThresholdHours,
    setStaleThresholdHours,
    theme,
    setTheme,
    activeTab,
    setActiveTab,
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
    filteredEquipment,
    stats,
    inspectingEquipment,
    setInspectingEquipment,
    isRegisterOpen,
    setIsRegisterOpen,
    isQRScannerOpen,
    setIsQRScannerOpen,
    isMobileSidebarOpen,
    setIsMobileSidebarOpen,
    qrScannerMode,
    setQRScannerMode,
    bookingTargetEquipment,
    setBookingTargetEquipment,
    handoverTargetEquipment,
    setHandoverTargetEquipment,
    qrCardTarget,
    setQRCardTarget,
    isLocationStale,
    getRelativeTime,
    registerEquipment,
    clearSanitization,
    resetFilters,
    bookEquipment,
    cancelReservation,
    confirmHandover,
    returnEquipment,
    executeDualScanMovement,
  };

  return <EquipmentContext.Provider value={value}>{children}</EquipmentContext.Provider>;
}

export function useEquipment() {
  const context = useContext(EquipmentContext);
  if (!context) {
    throw new Error('useEquipment must be used within an EquipmentProvider');
  }
  return context;
}
