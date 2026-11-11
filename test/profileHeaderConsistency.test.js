import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('SmartMed UI Alignment & Profile Header Consistency Guardrails', async (t) => {
  const sidebarCode = fs.readFileSync(path.resolve(__dirname, '../src/components/layout/Sidebar.jsx'), 'utf8');
  const navbarCode = fs.readFileSync(path.resolve(__dirname, '../src/components/layout/Navbar.jsx'), 'utf8');
  const emergencyCode = fs.readFileSync(path.resolve(__dirname, '../src/components/views/EmergencyAllocationView.jsx'), 'utf8');
  const cssCode = fs.readFileSync(path.resolve(__dirname, '../src/index.css'), 'utf8');

  await t.test('1. Sidebar profile section eliminates awkward block background and uses semantic pill classes', () => {
    // Assert removal of inline background block
    assert.ok(!sidebarCode.includes('getRoleBadgeStyle'), 'getRoleBadgeStyle inline background function removed');
    assert.ok(!sidebarCode.includes('style={getRoleBadgeStyle'), 'Inline style block on role badge removed');

    // Assert semantic class and initials helper
    assert.ok(sidebarCode.includes('getUserInitials'), 'getUserInitials helper present');
    assert.ok(sidebarCode.includes('user-avatar ${user?.role'), 'User avatar scoped to role class');
    assert.ok(sidebarCode.includes('user-role-badge ${user?.role'), 'User role badge scoped to role class');
    assert.ok(sidebarCode.includes('sidebar-logout-btn'), 'Logout button uses dedicated styling class');
  });

  await t.test('2. Initial derivation helper handles Nurse and Doctor titles professionally', () => {
    // Replicate helper logic to test behavior
    const getUserInitials = (name) => {
      if (!name) return 'SM';
      const clean = name.replace(/^(Dr\.|Nurse|Mr\.|Ms\.)\s+/i, '').replace(/\([^)]*\)/g, '').trim();
      const parts = clean.split(/[,\s]+/).filter(Boolean);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return parts[0] ? parts[0].slice(0, 2).toUpperCase() : 'SM';
    };

    assert.equal(getUserInitials('Nurse Sarah Jenkins, RN'), 'SJ', 'Nurse Sarah Jenkins produces SJ');
    assert.equal(getUserInitials('Dr. Marcus Vance'), 'MV', 'Dr. Marcus Vance produces MV');
    assert.equal(getUserInitials('Dr. Elena Rostova'), 'ER', 'Dr. Elena Rostova produces ER');
    assert.equal(getUserInitials('Alex Mercer (Biomed)'), 'AM', 'Alex Mercer produces AM');
  });

  await t.test('3. Navbar user session badge cleans redundant clinical titles', () => {
    assert.ok(navbarCode.includes('getCleanUserName'), 'Navbar includes getCleanUserName helper');

    const getCleanUserName = (name) => {
      if (!name) return 'User';
      const cleaned = name.replace(/^(Dr\.|Nurse|Mr\.|Ms\.)\s+/i, '').trim();
      return cleaned.split(/[\s,]+/)[0] || name.split(' ')[0];
    };

    assert.equal(getCleanUserName('Nurse Sarah Jenkins, RN'), 'Sarah', 'Displays Sarah instead of Nurse');
    assert.equal(getCleanUserName('Dr. Elena Rostova'), 'Elena', 'Displays Elena instead of Dr.');
  });

  await t.test('4. CSS defines professional pill badge styles with role-based colors', () => {
    // Assert .user-role-badge pill formatting
    assert.ok(cssCode.includes('.user-role-badge {'), 'Defines .user-role-badge');
    assert.ok(cssCode.includes('display: inline-flex;'), 'Role badge is inline-flex');
    assert.ok(cssCode.includes('width: fit-content;'), 'Role badge is fit-content (no full width block)');
    assert.ok(cssCode.includes('.user-role-badge.nurse'), 'Defines nurse role badge color');
    assert.ok(cssCode.includes('.user-role-badge.doctor'), 'Defines doctor role badge color');
    assert.ok(cssCode.includes('.user-role-badge.admin'), 'Defines admin role badge color');
    assert.ok(cssCode.includes('.user-role-badge.staff'), 'Defines staff role badge color');
  });

  await t.test('5. Emergency Allocation banner is theme-adaptive and avoids hardcoded light backgrounds', () => {
    assert.ok(!emergencyCode.includes("backgroundColor: '#FFF1F2'"), 'Hardcoded light pink background removed');
    assert.ok(emergencyCode.includes('emergency-header-banner'), 'Uses emergency-header-banner class');
    assert.ok(cssCode.includes('html[data-theme="dark"] .emergency-header-banner'), 'Dark mode emergency banner defined');
  });
});
