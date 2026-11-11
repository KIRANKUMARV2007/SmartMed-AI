import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_EQUIPMENT, HOSPITAL_ROOMS, DEMO_PERSONAS } from '../src/data/mockData.js';

test('SmartMed Dual-Scan QR Relocation Workflow Tests', async (t) => {
  // Test simulation helper emulating the context and modal engine
  function createTestDualScanEngine() {
    let equipment = JSON.parse(JSON.stringify(INITIAL_EQUIPMENT));
    let rooms = JSON.parse(JSON.stringify(HOSPITAL_ROOMS));
    let movements = [];
    let pendingEquipment = null;
    let activePersona = DEMO_PERSONAS[0];
    let isProcessing = false;
    let lastScan = { text: '', time: 0 };

    const parseQRPayload = (text) => {
      if (!text || typeof text !== 'string') {
        return { equipId: null, roomId: null, raw: '' };
      }

      const cleanText = text.trim();
      let equipId = null;
      let roomId = null;

      if (cleanText.startsWith('{') && cleanText.endsWith('}')) {
        try {
          const parsed = JSON.parse(cleanText);
          if (parsed.equipmentId || parsed.equipId) {
            equipId = parsed.equipmentId || parsed.equipId;
          } else if (parsed.roomId || (parsed.type === 'room' && parsed.id)) {
            roomId = parsed.roomId || parsed.id;
          } else if (parsed.type === 'equipment' && parsed.id) {
            equipId = parsed.id;
          } else if (parsed.room || parsed.roomName) {
            roomId = parsed.room || parsed.roomName;
          }
        } catch {}
      }

      if (!equipId && cleanText.includes('SMARTMED://EQUIPMENT/')) {
        equipId = cleanText.split('SMARTMED://EQUIPMENT/')[1]?.trim();
      }
      if (!roomId && cleanText.includes('SMARTMED://ROOM/')) {
        roomId = cleanText.split('SMARTMED://ROOM/')[1]?.trim();
      }

      if (!equipId && !roomId) {
        if (/^EQ-[A-Z0-9-]+$/i.test(cleanText)) {
          equipId = cleanText.toUpperCase();
        } else if (/^RM-[A-Z0-9-]+$/i.test(cleanText)) {
          roomId = cleanText.toUpperCase();
        }
      }

      if (!equipId && !roomId) {
        const matchedEquip = equipment.find(
          (e) =>
            e.id.toUpperCase() === cleanText.toUpperCase() ||
            (e.serialNumber && e.serialNumber.toUpperCase() === cleanText.toUpperCase())
        );
        if (matchedEquip) {
          equipId = matchedEquip.id;
        } else {
          const matchedRoom = rooms.find(
            (r) =>
              r.id.toUpperCase() === cleanText.toUpperCase() ||
              r.name.toLowerCase() === cleanText.toLowerCase() ||
              r.name.toLowerCase().startsWith(cleanText.toLowerCase())
          );
          if (matchedRoom) {
            roomId = matchedRoom.id;
          }
        }
      }

      return { equipId, roomId, raw: cleanText };
    };

    const executeDualScanMovement = (equipmentId, destinationRoomName) => {
      const item = equipment.find((e) => e.id === equipmentId);
      if (!item) return { success: false, error: 'Equipment not found' };

      const destRoom = rooms.find(
        (r) =>
          r.name === destinationRoomName ||
          r.id === destinationRoomName ||
          r.name.toLowerCase() === destinationRoomName?.toLowerCase()
      );
      if (!destRoom) return { success: false, error: 'Destination room not recognized' };

      if (item.currentRoom === destRoom.name) {
        return { success: false, error: `Equipment is already confirmed in ${destRoom.name}.` };
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

      equipment = equipment.map((e) => (e.id === equipmentId ? updatedItem : e));

      const log = {
        id: `MOV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
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

      movements = [log, ...movements];

      return {
        success: true,
        fromRoom: prevRoom,
        toRoom: destRoom.name,
        equipment: updatedItem,
      };
    };

    const handleScan = (decodedText) => {
      const now = Date.now();
      if (isProcessing) return { status: 'busy' };
      if (lastScan.text === decodedText && now - lastScan.time < 1200) {
        return { status: 'debounced' };
      }
      lastScan = { text: decodedText, time: now };

      const { equipId, roomId, raw } = parseQRPayload(decodedText);

      if (equipId) {
        const found = equipment.find((e) => e.id.toUpperCase() === equipId.toUpperCase());
        if (!found) return { status: 'error', error: `Equipment ID "${equipId}" not found` };

        if (pendingEquipment) {
          if (pendingEquipment.id === found.id) {
            return { status: 'already_selected', equipment: found };
          } else {
            return { status: 'conflict', pending: pendingEquipment, conflict: found };
          }
        }

        pendingEquipment = found;
        return { status: 'equipment_selected', equipment: found };
      }

      if (roomId) {
        const foundRoom = rooms.find(
          (r) =>
            r.id.toUpperCase() === roomId.toUpperCase() ||
            r.name.toLowerCase() === roomId.toLowerCase() ||
            r.name.toLowerCase().includes(roomId.toLowerCase())
        );
        if (!foundRoom) return { status: 'error', error: `Room "${roomId}" not found` };

        if (!pendingEquipment) {
          return {
            status: 'room_without_equipment',
            error: `Destination Room "${foundRoom.name}" recognized. Please scan the Equipment QR code first to initiate a relocation.`,
            room: foundRoom,
          };
        }

        // Automatic relocation
        if (pendingEquipment.currentRoom === foundRoom.name) {
          return {
            status: 'error',
            error: `Equipment is already confirmed in ${foundRoom.name}.`,
          };
        }

        isProcessing = true;
        try {
          const res = executeDualScanMovement(pendingEquipment.id, foundRoom.name);
          if (res.success) {
            const movedEquip = pendingEquipment;
            pendingEquipment = null;
            return {
              status: 'relocated',
              fromRoom: res.fromRoom,
              toRoom: res.toRoom,
              equipment: res.equipment,
            };
          }
          return { status: 'error', error: res.error };
        } finally {
          isProcessing = false;
        }
      }

      return { status: 'error', error: `Invalid QR code format: "${raw}"` };
    };

    return {
      getEquipment: () => equipment,
      getMovements: () => movements,
      getPending: () => pendingEquipment,
      handleScan,
      parseQRPayload,
    };
  }

  await t.test('Scenario 1: Room-first scan shows instruction and does not relocate', () => {
    const engine = createTestDualScanEngine();

    // User scans OT-2 room QR first without any equipment selected
    const result = engine.handleScan('SMARTMED://ROOM/RM-OT-02');

    assert.equal(result.status, 'room_without_equipment');
    assert.match(
      result.error,
      /Destination Room "OT-2 \(Cardiothoracic Theatre\)" recognized\. Please scan the Equipment QR code first/
    );
    assert.equal(engine.getPending(), null);
    assert.equal(engine.getMovements().length, 0, 'No audit record created on premature room scan');
  });

  await t.test('Scenario 2: Equipment-first scan selects equipment and preserves pending state', () => {
    const engine = createTestDualScanEngine();

    const result = engine.handleScan('SMARTMED://EQUIPMENT/EQ-ULT-01');

    assert.equal(result.status, 'equipment_selected');
    assert.equal(result.equipment.id, 'EQ-ULT-01');
    assert.equal(result.equipment.currentRoom, 'ER-101 (Trauma Bay 1)');
    assert.equal(engine.getPending()?.id, 'EQ-ULT-01', 'Pending equipment is stored for the next scan');
  });

  await t.test('Scenario 3: Complete EQ-ULT-01 relocation from ER-101 to OT-2', () => {
    const engine = createTestDualScanEngine();

    // Step 1: Scan EQ-ULT-01
    const step1 = engine.handleScan('SMARTMED://EQUIPMENT/EQ-ULT-01');
    assert.equal(step1.status, 'equipment_selected');
    assert.equal(engine.getPending()?.id, 'EQ-ULT-01');

    // Step 2: Scan Destination Room OT-2 placard
    const step2 = engine.handleScan('OT-2 (Cardiothoracic Theatre)');
    assert.equal(step2.status, 'relocated');
    assert.equal(step2.fromRoom, 'ER-101 (Trauma Bay 1)');
    assert.equal(step2.toRoom, 'OT-2 (Cardiothoracic Theatre)');
    assert.equal(step2.equipment.currentRoom, 'OT-2 (Cardiothoracic Theatre)');

    // Verify equipment state updated in roster
    const updatedEquip = engine.getEquipment().find((e) => e.id === 'EQ-ULT-01');
    assert.equal(updatedEquip.currentRoom, 'OT-2 (Cardiothoracic Theatre)');
    assert.equal(updatedEquip.roomId, 'RM-OT-02');

    // Verify movement audit log created with origin, destination, custodian, and timestamp
    const movements = engine.getMovements();
    assert.equal(movements.length, 1);
    assert.equal(movements[0].equipmentId, 'EQ-ULT-01');
    assert.equal(movements[0].fromRoom, 'ER-101 (Trauma Bay 1)');
    assert.equal(movements[0].toRoom, 'OT-2 (Cardiothoracic Theatre)');
    assert.equal(movements[0].type, 'Dual-QR Verified Transfer');
    assert.ok(movements[0].timestamp);
    assert.ok(movements[0].staffName);

    // Verify pending equipment was cleared after successful transfer
    assert.equal(engine.getPending(), null);
  });

  await t.test('Scenario 4: Rejects moving equipment to the exact same room', () => {
    const engine = createTestDualScanEngine();

    // EQ-ULT-01 is initially in ER-101
    engine.handleScan('SMARTMED://EQUIPMENT/EQ-ULT-01');
    const result = engine.handleScan('SMARTMED://ROOM/RM-ER-101');

    assert.equal(result.status, 'error');
    assert.match(result.error, /already confirmed in ER-101/);
    assert.equal(engine.getMovements().length, 0);
  });

  await t.test('Scenario 5: Payload parser handles JSON, URI, ID, and Placard strings', () => {
    const engine = createTestDualScanEngine();

    // JSON equipment
    const p1 = engine.parseQRPayload('{"type":"equipment","id":"EQ-ULT-01"}');
    assert.equal(p1.equipId, 'EQ-ULT-01');

    // JSON room
    const p2 = engine.parseQRPayload('{"roomId":"RM-OT-02"}');
    assert.equal(p2.roomId, 'RM-OT-02');

    // Raw room placard string
    const p3 = engine.parseQRPayload('OT-2 (Cardiothoracic Theatre)');
    assert.equal(p3.roomId, 'RM-OT-02');

    // Raw equipment ID
    const p4 = engine.parseQRPayload('EQ-ULT-01');
    assert.equal(p4.equipId, 'EQ-ULT-01');
  });

  await t.test('Scenario 6: Prevents duplicate movement submission on rapid identical scan', () => {
    const engine = createTestDualScanEngine();

    engine.handleScan('SMARTMED://EQUIPMENT/EQ-ULT-01');
    const move1 = engine.handleScan('SMARTMED://ROOM/RM-OT-02');
    assert.equal(move1.status, 'relocated');

    // Repeated camera frame right after relocation
    const move2 = engine.handleScan('SMARTMED://ROOM/RM-OT-02');
    assert.equal(move2.status, 'debounced');
    assert.equal(engine.getMovements().length, 1, 'Only one audit log record recorded');
  });
});
