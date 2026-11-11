import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cssPath = path.resolve(__dirname, '../src/index.css');
const cssContent = fs.readFileSync(cssPath, 'utf8');

test('SmartMed Responsive Layout & Mobile-First Guardrails', async (t) => {
  await t.test('1. Core Breakpoint Hierarchy is Defined in CSS', () => {
    // Check that target viewport breakpoints exist
    assert.match(cssContent, /@media\s*\(\s*max-width:\s*900px\s*\)/, 'Tablet breakpoint (<=900px) must exist');
    assert.match(cssContent, /@media\s*\(\s*max-width:\s*768px\s*\)/, 'Mobile screens breakpoint (<=768px) must exist');
    assert.match(cssContent, /@media\s*\(\s*max-width:\s*640px\s*\)/, 'Phone screens breakpoint (<=640px) must exist');
    assert.match(cssContent, /@media\s*\(\s*max-width:\s*480px\s*\)/, 'Standard phone breakpoint (<=480px) must exist');
    assert.match(cssContent, /@media\s*\(\s*max-width:\s*375px\s*\)/, 'Compact phone breakpoint (<=375px / 320px) must exist');
  });

  await t.test('2. Mobile Drawer & Backdrop Navigation Contract', () => {
    // Sidebar off-canvas rules
    assert.match(cssContent, /\.sidebar\s*\{[^}]*position:\s*fixed/s, 'Sidebar must be fixed positioned on mobile/tablet');
    assert.match(cssContent, /\.sidebar\.open\s*\{[^}]*left:\s*0/s, 'Sidebar open must slide into view at left: 0');
    assert.match(cssContent, /\.sidebar-backdrop\.active\s*\{[^}]*opacity:\s*1/s, 'Active sidebar backdrop must be visible (opacity: 1)');
    assert.match(cssContent, /\.navbar-hamburger-btn\s*\{[^}]*display:\s*flex/s, 'Hamburger button must display on mobile/tablet');
  });

  await t.test('3. Mobile Bottom Navigation & Touch Target Sizing', () => {
    assert.match(cssContent, /\.mobile-bottom-nav\s*\{[^}]*display:\s*flex/s, 'Bottom nav must display on mobile');
    assert.match(cssContent, /\.mobile-bottom-nav\s*\{[^}]*position:\s*fixed/s, 'Bottom nav must be fixed positioned at viewport bottom');
    assert.match(cssContent, /\.mobile-nav-btn\s*\{[^}]*min-width:\s*44px/s, 'Mobile nav buttons must meet comfortable touch target size (min-width: 44px)');
    assert.match(cssContent, /\.mobile-nav-qr-btn\s*\{[^}]*width:\s*52px;\s*height:\s*52px/s, 'Floating QR button must have 52px touch area');
  });

  await t.test('4. Contained Horizontal Scrolling on Tables & Pills', () => {
    assert.match(cssContent, /\.table-wrapper\s*\{[^}]*overflow-x:\s*auto/s, 'Table wrapper must support horizontal overflow scrolling');
    assert.match(cssContent, /\.status-pills-row\s*\{[^}]*overflow-x:\s*auto/s, 'Status pills row must allow horizontal touch scroll');
  });

  await t.test('5. Clinical Safety & Demo Banner Preservation on Mobile', () => {
    // Must NOT hide .demo-banner-meta with display: none
    const phoneBreakpointIndex = cssContent.indexOf('PHONE SCREENS (<= 640px)');
    const max640Block = cssContent.slice(phoneBreakpointIndex !== -1 ? phoneBreakpointIndex : cssContent.lastIndexOf('@media (max-width: 640px)'));
    const max640Section = max640Block.slice(0, max640Block.indexOf('@media (max-width: 480px)'));

    assert.ok(
      !max640Section.includes('.demo-banner-meta {\n    display: none !important;'),
      'Critical clinical safety info (.demo-banner-meta) must NOT be hidden with display: none on phones'
    );
    assert.match(max640Section, /\.demo-banner-meta\s*\{[^}]*display:\s*flex\s*!important/s, 'Demo banner meta must remain flex-wrapped on phones');
  });

  await t.test('6. Bottom-Sheet Modal Conversions on Narrow Viewports', () => {
    const phoneBreakpointIndex = cssContent.indexOf('PHONE SCREENS (<= 640px)');
    const max640Block = cssContent.slice(phoneBreakpointIndex !== -1 ? phoneBreakpointIndex : cssContent.lastIndexOf('@media (max-width: 640px)'));
    assert.match(max640Block, /\.modal-backdrop\s*\{[^}]*align-items:\s*flex-end/s, 'Modal backdrop must dock to bottom on phones');
    assert.match(max640Block, /\.modal-dialog\s*\{[^}]*border-radius:\s*20px 20px 0 0/s, 'Modal dialog must have top rounded corners as a bottom sheet');
    assert.match(max640Block, /\.modal-dialog\s*\{[^}]*max-height:\s*92vh/s, 'Modal dialog height must be constrained within viewport');
  });

  await t.test('7. Component-Level Split Grids Reflow into Single Column', () => {
    assert.match(cssContent, /\.emergency-main-grid\s*\{/, 'emergency-main-grid class must exist');
    assert.match(cssContent, /@media\s*\(\s*max-width:\s*1024px\s*\)[^{]*\{[^}]*\.emergency-main-grid\s*\{[^}]*grid-template-columns:\s*1fr/s, 'emergency-main-grid must reflow to 1fr on tablet');
    assert.match(cssContent, /\.maintenance-metrics-split-grid\s*\{/, 'maintenance-metrics-split-grid class must exist');
    assert.match(cssContent, /@media\s*\(\s*max-width:\s*768px\s*\)[^{]*\{[^}]*\.maintenance-metrics-split-grid\s*\{[^}]*grid-template-columns:\s*1fr/s, 'maintenance-metrics-split-grid must reflow to 1fr on mobile');
    assert.match(cssContent, /\.route-planner-grid\s*\{/, 'route-planner-grid class must exist');
  });

  await t.test('8. Viewport Extremes: 320px and 375px Guardrails', () => {
    const max375Block = cssContent.slice(cssContent.indexOf('@media (max-width: 375px)'));
    assert.match(max375Block, /\.page-title-group\s*\{[^}]*max-width:\s*110px/s, 'Page title must have safe max-width on 320-375px screens');
    assert.match(max375Block, /\.metrics-grid\s*\{[^}]*grid-template-columns:\s*1fr/s, 'KPI metrics grid must reflow to 1 column on 320-375px screens');
    assert.match(max375Block, /\.login-card\s*\{[^}]*padding:\s*16px 12px/s, 'Login card must have compact padding on 320px screens');
  });

  await t.test('9. Clinical Table Minimum Width & Touch Scrolling', () => {
    assert.match(cssContent, /\.clinical-table\s*\{[^}]*min-width:\s*760px/s, 'Clinical table must have min-width 760px to preserve legibility');
    assert.match(cssContent, /\.table-wrapper\s*\{[^}]*-webkit-overflow-scrolling:\s*touch/s, 'Table wrapper must support smooth iOS touch scrolling');
  });

  await t.test('10. Emergency Candidate Action Buttons Stack on Narrow Screens', () => {
    assert.match(cssContent, /\.candidate-action-buttons-row\s*\{/, 'candidate-action-buttons-row class must exist');
    assert.match(cssContent, /@media\s*\(\s*max-width:\s*600px\s*\)[^{]*\{[^}]*\.candidate-action-buttons-row\s*\{[^}]*flex-direction:\s*column/s, 'candidate-action-buttons-row must stack vertically on narrow screens');
  });
});
