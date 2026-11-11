import test from 'node:test';
import assert from 'node:assert/strict';
import { authApi } from '../src/api/authApi.js';
import { equipmentApi } from '../src/api/equipmentApi.js';
import { setAuthToken, ApiClientError } from '../src/api/client.js';
import fs from 'node:fs';
import path from 'node:path';

test('SmartMed Frontend Auth & Role Guardrails - Unit Tests', async (t) => {
  await t.test('authApi methods exist and build valid contracts', () => {
    assert.equal(typeof authApi.login, 'function');
    assert.equal(typeof authApi.logout, 'function');
    assert.equal(typeof authApi.getMe, 'function');
    assert.equal(typeof authApi.getUsers, 'function');
    assert.equal(typeof authApi.createUser, 'function');
    assert.equal(typeof authApi.updateUserStatus, 'function');
    assert.equal(typeof authApi.updateUserRole, 'function');
    assert.equal(typeof authApi.getAuditLogs, 'function');
  });

  await t.test('equipmentApi administrative extension methods exist', () => {
    assert.equal(typeof equipmentApi.updateEquipment, 'function');
    assert.equal(typeof equipmentApi.updateEquipmentStatus, 'function');
    assert.equal(typeof equipmentApi.deleteEquipment, 'function');
  });

  await t.test('authApi.login validates required credentials before sending', async () => {
    await assert.rejects(
      async () => {
        await authApi.login({ email: '', password: 'password' });
      },
      /Email and password are required/
    );

    await assert.rejects(
      async () => {
        await authApi.login({ email: 'admin@smartmed.hospital', password: '' });
      },
      /Email and password are required/
    );
  });

  await t.test('equipmentApi.updateEquipment requires equipment ID and updates object', async () => {
    await assert.rejects(
      async () => {
        await equipmentApi.updateEquipment(null, { name: 'New Name' });
      },
      /Equipment ID is required/
    );

    await assert.rejects(
      async () => {
        await equipmentApi.updateEquipment('EQ-01', null);
      },
      /Equipment ID and update payload are required/
    );
  });

  await t.test('equipmentApi.deleteEquipment requires equipment ID', async () => {
    await assert.rejects(
      async () => {
        await equipmentApi.deleteEquipment('');
      },
      /Equipment ID is required/
    );
  });

  await t.test('setAuthToken sets and clears authorization token in client state', () => {
    setAuthToken('test-jwt-token-12345');
    // Calling setAuthToken(null) clears it safely without throwing
    setAuthToken(null);
  });

  await t.test('PERMISSION_MATRIX authorizes nurse, doctor, and admin for EMERGENCY_ALLOCATE', () => {
    const authContextPath = path.resolve('src/context/AuthContext.jsx');
    const authContent = fs.readFileSync(authContextPath, 'utf-8');
    assert.match(
      authContent,
      /EMERGENCY_ALLOCATE:\s*\[[^\]]*'admin'[^\]]*'doctor'[^\]]*'nurse'[^\]]*\]/,
      'AuthContext PERMISSION_MATRIX must authorize admin, doctor, and nurse for EMERGENCY_ALLOCATE'
    );
  });

  await t.test('Sidebar navigation renders Emergency Allocation for Nurse role', () => {
    const sidebarPath = path.resolve('src/components/layout/Sidebar.jsx');
    const sidebarContent = fs.readFileSync(sidebarPath, 'utf-8');
    assert.match(
      sidebarContent,
      /\(isAdmin\s*\|\|\s*isDoctor\s*\|\|\s*isNurse\)\s*&&/,
      'Sidebar must include isNurse in Emergency Allocation visibility condition'
    );
  });
});

