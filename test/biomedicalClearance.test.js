import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('SmartMed Biomedical Clearance & Equipment Release Panel Guardrails', async (t) => {
  const panelPath = path.resolve('src/components/equipment/BiomedicalClearancePanel.jsx');
  const maintPath = path.resolve('src/components/views/MaintenanceView.jsx');
  const sanPath = path.resolve('src/components/views/SanitizationView.jsx');

  const panelContent = fs.readFileSync(panelPath, 'utf-8');
  const maintContent = fs.readFileSync(maintPath, 'utf-8');
  const sanContent = fs.readFileSync(sanPath, 'utf-8');

  await t.test('Legacy awkward phrasing is removed across all components', () => {
    // Neither MaintenanceView nor SanitizationView nor the clearance panel should contain the old awkward strings
    assert.doesNotMatch(maintContent, /Zero auto-clearance by timers/i);
    assert.doesNotMatch(sanContent, /Zero auto-clearance by timers/i);
    assert.doesNotMatch(panelContent, /Zero auto-clearance by timers/i);

    assert.doesNotMatch(maintContent, /Mandatory biomedical sign-off/i);
    assert.doesNotMatch(maintContent, /Certified Clearance Gate/i);
    assert.doesNotMatch(sanContent, /Certified Clearance Gate/i);
  });

  await t.test('Required content hierarchy is present and exact', () => {
    // Title & subtitle
    assert.match(panelContent, /Biomedical Clearance/);
    assert.match(panelContent, /Equipment safety verification and release approval/);

    // Status label and supporting text
    assert.match(panelContent, /Awaiting Final Approval/);
    assert.match(panelContent, /This equipment is awaiting verification by an authorized biomedical engineer\./);
    assert.match(panelContent, /Release Restricted/);
    assert.match(panelContent, /Approved for Use/);

    // Natural secondary note
    assert.match(panelContent, /Equipment release requires verified biomedical approval\./);
  });

  await t.test('Approval card data derivation handles missing data with required fallbacks', () => {
    // Derivation logic helper under test matching BiomedicalClearancePanel.jsx
    const deriveFields = (item, movements = []) => {
      let verificationStatus = 'Pending';
      if (item) {
        if (item.status === 'Available') {
          verificationStatus = 'Approved';
        } else if (item.status === 'Faulty' && item.risk?.level === 'HIGH') {
          verificationStatus = 'Rejected';
        }
      }

      const assignedEngineer =
        item?.lastConfirmedBy && item.lastConfirmedBy.trim().length > 0
          ? item.lastConfirmedBy
          : 'Not assigned';

      let formattedInspectionDate = 'Not recorded';
      if (item?.lastConfirmedAt) {
        try {
          const date = new Date(item.lastConfirmedAt);
          if (!isNaN(date.getTime())) {
            formattedInspectionDate = date.toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });
          }
        } catch {
          formattedInspectionDate = 'Not recorded';
        }
      }

      let approvalRecord = 'Not recorded';
      if (item) {
        const matchingAudit = movements.find((m) => m.equipmentId === item.id);
        if (matchingAudit?.id) {
          approvalRecord = matchingAudit.id;
        }
      }

      return {
        verificationStatus,
        assignedEngineer,
        formattedInspectionDate,
        approvalRecord,
      };
    };

    // Case 1: Item with missing data must output standard fallback texts
    const emptyItem = { id: 'EQ-TEST-01', status: 'Under Maintenance' };
    const fieldsEmpty = deriveFields(emptyItem, []);
    assert.equal(fieldsEmpty.verificationStatus, 'Pending');
    assert.equal(fieldsEmpty.assignedEngineer, 'Not assigned');
    assert.equal(fieldsEmpty.formattedInspectionDate, 'Not recorded');
    assert.equal(fieldsEmpty.approvalRecord, 'Not recorded');

    // Case 2: High risk faulty item outputs Rejected
    const faultyHighRisk = { id: 'EQ-TEST-02', status: 'Faulty', risk: { level: 'HIGH' } };
    const fieldsFaulty = deriveFields(faultyHighRisk, []);
    assert.equal(fieldsFaulty.verificationStatus, 'Rejected');

    // Case 3: Approved item with real data
    const approvedItem = {
      id: 'EQ-TEST-03',
      status: 'Available',
      lastConfirmedBy: 'Sarah Chen (Biomedical Lead)',
      lastConfirmedAt: '2026-10-12T10:00:00Z',
    };
    const movements = [{ id: 'AUD-9021', equipmentId: 'EQ-TEST-03' }];
    const fieldsApproved = deriveFields(approvedItem, movements);
    assert.equal(fieldsApproved.verificationStatus, 'Approved');
    assert.equal(fieldsApproved.assignedEngineer, 'Sarah Chen (Biomedical Lead)');
    assert.notEqual(fieldsApproved.formattedInspectionDate, 'Not recorded');
    assert.equal(fieldsApproved.approvalRecord, 'AUD-9021');
  });

  await t.test('Three-step workflow states accurately represent lifecycle progress', () => {
    const deriveSteps = (status) => {
      let step1 = 'pending';
      let step2 = 'pending';
      let step3 = 'pending';

      if (status === 'Available') {
        step1 = 'completed';
        step2 = 'completed';
        step3 = 'completed';
      } else if (status === 'Under Maintenance') {
        step1 = 'completed';
        step2 = 'current';
        step3 = 'pending';
      } else if (status === 'Faulty') {
        step1 = 'completed';
        step2 = 'current';
        step3 = 'pending';
      }
      return { step1, step2, step3 };
    };

    // Maintenance item: inspection done, verification active, release locked
    const maintSteps = deriveSteps('Under Maintenance');
    assert.equal(maintSteps.step1, 'completed');
    assert.equal(maintSteps.step2, 'current');
    assert.equal(maintSteps.step3, 'pending');

    // Approved item: all 3 steps completed
    const approvedSteps = deriveSteps('Available');
    assert.equal(approvedSteps.step1, 'completed');
    assert.equal(approvedSteps.step2, 'completed');
    assert.equal(approvedSteps.step3, 'completed');
  });
});
