import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRoomQRPayload, findMatchingRoom, classifyCameraError } from '../src/utils/roomQrParser.js';
import { HOSPITAL_ROOMS } from '../src/data/mockData.js';

test('SmartMed Room QR Placard Parser & Validator Tests', async (t) => {
  await t.test('Standard URI format: SMARTMED://ROOM/RM-ICU-201 resolves to ICU-201 (Bed A)', () => {
    const res = parseRoomQRPayload('SMARTMED://ROOM/RM-ICU-201', HOSPITAL_ROOMS);
    assert.equal(res.success, true);
    assert.equal(res.room.id, 'RM-ICU-201');
    assert.equal(res.room.name, 'ICU-201 (Bed A)');
    assert.equal(res.room.floor, 'Floor 2');
  });

  await t.test('Case-insensitivity: smartmed://room/rm-er-101 resolves to ER-101', () => {
    const res = parseRoomQRPayload('smartmed://room/rm-er-101', HOSPITAL_ROOMS);
    assert.equal(res.success, true);
    assert.equal(res.room.id, 'RM-ER-101');
    assert.equal(res.room.name, 'ER-101 (Trauma Bay 1)');
  });

  await t.test('JSON payloads: {"roomId": "RM-ICU-204"} resolves correctly', () => {
    const jsonPayload = JSON.stringify({ roomId: 'RM-ICU-204' });
    const res = parseRoomQRPayload(jsonPayload, HOSPITAL_ROOMS);
    assert.equal(res.success, true);
    assert.equal(res.room.id, 'RM-ICU-204');
    assert.equal(res.room.name, 'ICU-204 (Negative Pressure Isolation)');
  });

  await t.test('JSON payloads: {"type": "room", "id": "RM-W3A-05"} resolves correctly', () => {
    const jsonPayload = JSON.stringify({ type: 'room', id: 'RM-W3A-05' });
    const res = parseRoomQRPayload(jsonPayload, HOSPITAL_ROOMS);
    assert.equal(res.success, true);
    assert.equal(res.room.id, 'RM-W3A-05');
    assert.equal(res.room.name, 'Ward 3A (Room 305)');
  });

  await t.test('URL queries: https://smartmed.hospital/?room=RM-ICU-202 resolves correctly', () => {
    const res = parseRoomQRPayload('https://smartmed.hospital/?room=RM-ICU-202', HOSPITAL_ROOMS);
    assert.equal(res.success, true);
    assert.equal(res.room.id, 'RM-ICU-202');
    assert.equal(res.room.name, 'ICU-202 (Bed B)');
  });

  await t.test('Clinical short codes and aliases: "ICU-201", "ER-101", "OT-1", "PACU-1"', () => {
    const icu = parseRoomQRPayload('ICU-201', HOSPITAL_ROOMS);
    assert.equal(icu.success, true);
    assert.equal(icu.room.id, 'RM-ICU-201');

    const er = parseRoomQRPayload('ER-101', HOSPITAL_ROOMS);
    assert.equal(er.success, true);
    assert.equal(er.room.id, 'RM-ER-101');

    const ot = parseRoomQRPayload('OT-1', HOSPITAL_ROOMS);
    assert.equal(ot.success, true);
    assert.equal(ot.room.id, 'RM-OT-01');

    const pacu = parseRoomQRPayload('PACU-1', HOSPITAL_ROOMS);
    assert.equal(pacu.success, true);
    assert.equal(pacu.room.id, 'RM-PACU-01');
  });

  await t.test('Full room name match: "Radiology & CT Diagnostic Suite 101"', () => {
    const res = parseRoomQRPayload('Radiology & CT Diagnostic Suite 101', HOSPITAL_ROOMS);
    assert.equal(res.success, true);
    assert.equal(res.room.id, 'RM-RAD-101');
  });

  await t.test('Clinical safety: Explicitly rejects Equipment QR tags with clear guidance', () => {
    const uriResult = parseRoomQRPayload('SMARTMED://EQUIPMENT/EQ-VENT-01', HOSPITAL_ROOMS);
    assert.equal(uriResult.success, false);
    assert.equal(uriResult.isEquipment, true);
    assert.match(uriResult.error, /Equipment/i);

    const idResult = parseRoomQRPayload('EQ-VENT-01', HOSPITAL_ROOMS);
    assert.equal(idResult.success, false);
    assert.equal(idResult.isEquipment, true);

    const jsonResult = parseRoomQRPayload(JSON.stringify({ type: 'equipment', id: 'EQ-DEFIB-01' }), HOSPITAL_ROOMS);
    assert.equal(jsonResult.success, false);
    assert.equal(jsonResult.isEquipment, true);
  });

  await t.test('Clinical safety: Rejects arbitrary non-room text without false positives', () => {
    const arbitrary = ['hello world', '12345', 'ventilator', 'random test text', 'medication trolley'];
    for (const text of arbitrary) {
      const res = parseRoomQRPayload(text, HOSPITAL_ROOMS);
      assert.equal(res.success, false, `Should reject arbitrary string: "${text}"`);
      assert.match(res.error, /not recognized in the hospital registry/i);
    }
  });

  await t.test('Unknown room QR: SMARTMED://ROOM/RM-UNKNOWN-999 is rejected', () => {
    const res = parseRoomQRPayload('SMARTMED://ROOM/RM-UNKNOWN-999', HOSPITAL_ROOMS);
    assert.equal(res.success, false);
    assert.match(res.error, /not recognized in the hospital registry/i);
  });

  await t.test('Empty or null input safely handled', () => {
    assert.equal(parseRoomQRPayload(null).success, false);
    assert.equal(parseRoomQRPayload('').success, false);
    assert.equal(parseRoomQRPayload('   ').success, false);
  });
});

test('SmartMed Camera Error Categorization & Status Guidance Tests', async (t) => {

  await t.test('Camera permission denied: NotAllowedError / PermissionDeniedError', () => {
    const err = new Error('Permission denied');
    err.name = 'NotAllowedError';
    const res = classifyCameraError(err, { isSecure: true, hasMediaDevices: true });
    assert.equal(res.type, 'permission_denied');
    assert.match(res.message, /permission denied/i);
  });

  await t.test('No camera device found: NotFoundError / DevicesNotFoundError', () => {
    const err = new Error('Requested device not found');
    err.name = 'NotFoundError';
    const res = classifyCameraError(err, { isSecure: true, hasMediaDevices: true });
    assert.equal(res.type, 'camera_unavailable');
    assert.match(res.message, /no camera device found/i);
  });

  await t.test('Camera already in use: NotReadableError / TrackStartError', () => {
    const err = new Error('Could not start video source: device in use');
    err.name = 'NotReadableError';
    const res = classifyCameraError(err, { isSecure: true, hasMediaDevices: true });
    assert.equal(res.type, 'camera_in_use');
    assert.match(res.message, /already in use/i);
  });

  await t.test('Camera API unavailable: Insecure context or missing getUserMedia', () => {
    const insecureRes = classifyCameraError(null, { isSecure: false, hasMediaDevices: true });
    assert.equal(insecureRes.type, 'api_unavailable');
    assert.match(insecureRes.message, /HTTPS or localhost/i);

    const noApiRes = classifyCameraError(null, { isSecure: true, hasMediaDevices: false });
    assert.equal(noApiRes.type, 'api_unavailable');
    assert.match(noApiRes.message, /does not support mediaDevices/i);
  });

  await t.test('Camera initialization or decoding failure: OverconstrainedError or general error', () => {
    const overconstrainedErr = new Error('Constraints could not be satisfied');
    overconstrainedErr.name = 'OverconstrainedError';
    const res1 = classifyCameraError(overconstrainedErr, { isSecure: true, hasMediaDevices: true });
    assert.equal(res1.type, 'overconstrained');

    const generalErr = new Error('Webcam driver failed to respond');
    const res2 = classifyCameraError(generalErr, { isSecure: true, hasMediaDevices: true });
    assert.equal(res2.type, 'init_failed');
    assert.match(res2.message, /Webcam driver failed to respond/i);
  });
});

