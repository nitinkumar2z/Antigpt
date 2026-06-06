// Interactive functionality for Compliance Patent Cost Estimator by Building Type

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('estimator-form');
  if (!form) return;

  // Retrieve inputs
  const buildingTypeSelect = document.getElementById('building-type');
  const patentCountInput = document.getElementById('patent-count');
  const regionSelect = document.getElementById('region');
  const entitySizeSelect = document.getElementById('entity-size');
  const appTypeSelect = document.getElementById('app-type');
  const lawFirmSelect = document.getElementById('law-firm');

  // Retrieve output elements
  const totalAmount = document.getElementById('total-amount');
  const valueFiling = document.getElementById('value-filing');
  const valueLegal = document.getElementById('value-legal');
  const valueMaintenance = document.getElementById('value-maintenance');
  const valueAudit = document.getElementById('value-audit');

  // Retrieve bar elements
  const barFiling = document.getElementById('bar-filing');
  const barLegal = document.getElementById('bar-legal');
  const barMaintenance = document.getElementById('bar-maintenance');

  // Calculate costs based on realUSPTO schedules and estimate logic
  function calculate() {
    const buildingType = buildingTypeSelect.value;
    const patentCount = parseInt(patentCountInput.value, 10) || 1;
    const region = regionSelect.value;
    const entitySize = entitySizeSelect.value;
    const appType = appTypeSelect.value;
    const lawFirm = lawFirmSelect.value;

    // 1. USPTO Filing Fees schedule (approximate base rates)
    // Small gets 60% discount (pays 40%), Micro gets 80% discount (pays 20%)
    let baseFilingFee = 0;
    if (appType === 'utility') {
      baseFilingFee = 1820; // filing + search + examination
    } else if (appType === 'design') {
      baseFilingFee = 1020;
    } else if (appType === 'plant') {
      baseFilingFee = 1220;
    }

    let discountMultiplier = 1.0;
    if (entitySize === 'small') {
      discountMultiplier = 0.4;
    } else if (entitySize === 'micro') {
      discountMultiplier = 0.2;
    }

    const filingFees = Math.round(baseFilingFee * discountMultiplier * patentCount);

    // 2. Legal Drafting Fees based on complexity of building type and law firm tier
    // Let's assess complexity rating of building types (1 to 5)
    let complexityRating = 3;
    const complexTypes = ['data-center', 'pharmaceutical-laboratory', 'nuclear-power-facility', 'spaceport-launching-facility', 'chemical-processing-refinery', 'server-farm'];
    const simpleTypes = ['single-family-residential', 'greenhouse-facility', 'livestock-barn', 'parking-garage', 'self-storage-facility'];

    if (complexTypes.includes(buildingType)) {
      complexityRating = 5;
    } else if (simpleTypes.includes(buildingType)) {
      complexityRating = 2;
    }

    let baseLegalFee = 3000; // standard mechanical/simple draft
    if (complexityRating === 5) {
      baseLegalFee = 9500; // complex tech/chem draft
    } else if (complexityRating === 4) {
      baseLegalFee = 6500;
    } else if (complexityRating === 2) {
      baseLegalFee = 2000;
    }

    let lawFirmMultiplier = 1.0;
    if (lawFirm === 'self') {
      lawFirmMultiplier = 0.0;
    } else if (lawFirm === 'agent') {
      lawFirmMultiplier = 0.6;
    } else if (lawFirm === 'toptier') {
      lawFirmMultiplier = 1.8;
    }

    const legalFees = Math.round(baseLegalFee * lawFirmMultiplier * patentCount);

    // 3. Maintenance Fees (over 20 years - USPTO charges at 3.5, 7.5, 11.5 years)
    // 3.5 yr: $2,000, 7.5 yr: $3,760, 11.5 yr: $7,700
    let baseMaintenanceTotal = 0;
    if (appType === 'utility') {
      baseMaintenanceTotal = 2000 + 3760 + 7700;
    }
    const maintenanceFees = Math.round(baseMaintenanceTotal * discountMultiplier * patentCount);

    // 4. Compliance Audit & Filing costs
    const auditCost = lawFirm === 'self' ? 250 : Math.round(1200 * lawFirmMultiplier);

    // Totals
    const total = filingFees + legalFees + maintenanceFees + auditCost;

    // Update Text Outputs
    totalAmount.textContent = `$${total.toLocaleString()}`;
    valueFiling.textContent = `$${filingFees.toLocaleString()}`;
    valueLegal.textContent = `$${legalFees.toLocaleString()}`;
    valueMaintenance.textContent = `$${maintenanceFees.toLocaleString()}`;
    valueAudit.textContent = `$${auditCost.toLocaleString()}`;

    // Update CSS Chart Bars (normalized by maximum possible total, say $50,000)
    const maxVal = Math.max(total, 15000);
    const filingPct = Math.round((filingFees / maxVal) * 100);
    const legalPct = Math.round((legalFees / maxVal) * 100);
    const maintenancePct = Math.round((maintenanceFees / maxVal) * 100);

    barFiling.style.width = `${filingPct}%`;
    barLegal.style.width = `${legalPct}%`;
    barMaintenance.style.width = `${maintenancePct}%`;
  }

  // Bind change events
  form.addEventListener('input', calculate);
  form.addEventListener('change', calculate);
  
  // Custom submit to prevent page reload but recalculate
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    calculate();
  });

  // Initial calculation
  calculate();
});
