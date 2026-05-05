#!/usr/bin/env node

/**
 * Ward Name Corrections Script
 * 
 * Fixes compound ward names that were merged during shapefile parsing.
 * These corrections are applied before deploying to Supabase.
 * 
 * Usage: node scripts/fix-ward-names.js
 */

const fs = require('fs');
const path = require('path');

// =========================================================================
// WARD NAME CORRECTIONS DICTIONARY
// =========================================================================
// Map of incorrect names to correct names
// Format: { incorrect: { displayName, id },  correct: { displayName, id } }

const WARD_CORRECTIONS = {
  'Macalderkanyarwanda Ward': {
    correct: 'Macalder-Kanyarwanda Ward',
    id: 'macalder-kanyarwanda-ward',
    reason: 'Compound name: Macalder + Kanyarwanda (needs hyphen)'
  },
  'Songhorsoba Ward': {
    correct: 'Songhor/Soba Ward', 
    id: 'songhor/soba-ward',
    reason: 'Compound name: Songhor + Soba (needs slash)'
  },
  // Add more corrections here as discovered
};

// =========================================================================
// MAIN FUNCTION
// =========================================================================

async function fixWardNames() {
  const seedFile = path.join(__dirname, '../lib/seed_kenya_locations.sql');
  
  console.log('[INFO] Loading seed file...');
  if (!fs.existsSync(seedFile)) {
    console.error('[ERROR] Seed file not found:', seedFile);
    process.exit(1);
  }

  let content = fs.readFileSync(seedFile, 'utf-8');
  let fixCount = 0;

  console.log('[INFO] Applying ward name corrections...\n');

  for (const [incorrect, correction] of Object.entries(WARD_CORRECTIONS)) {
    const { correct, reason } = correction;
    
    // Pattern to find and replace
    // Looking for: ward_xxxxx-ward', 'Incorrect Ward Name', 'const_xxxxx
    const pattern = new RegExp(
      `\\(('ward_[^']*'),\\s*'${incorrect}'`,
      'g'
    );
    
    const matches = [...content.matchAll(pattern)];
    
    if (matches.length > 0) {
      // Replace the display name
      content = content.replace(
        new RegExp(`'${incorrect}'`, 'g'),
        `'${correct}'`
      );
      
      console.log(`✓ Fixed: ${incorrect} → ${correct}`);
      console.log(`  Reason: ${reason}`);
      console.log(`  Occurrences: ${matches.length}\n`);
      
      fixCount += matches.length;
    }
  }

  // Save corrected file
  console.log(`[INFO] Saving corrected seed file...`);
  fs.writeFileSync(seedFile, content, 'utf-8');

  console.log(`\n========================================`);
  console.log(`✓ SUCCESS: Applied ${fixCount} ward name corrections`);
  console.log(`========================================\n`);
  console.log(`Ready to deploy to Supabase with:`);
  console.log(`  psql -h <host> -U <user> -d <database> -f lib/seed_kenya_locations.sql\n`);
}

// =========================================================================
// DISCOVERY MODE (Optional: Scan for potential issues)
// =========================================================================

function discoverPotentialIssues() {
  const seedFile = path.join(__dirname, '../lib/seed_kenya_locations.sql');
  const content = fs.readFileSync(seedFile, 'utf-8');
  
  console.log('[INFO] Scanning for potential compound ward names...\n');
  
  // Find all ward names
  const wardPattern = /INSERT INTO wards.*VALUES \('[^']*',\s*'([^']+)'/g;
  const wards = new Set();
  let match;
  
  while ((match = wardPattern.exec(content)) !== null) {
    const wardName = match[1];
    // Check for signs of compound names (lowercase letters followed by uppercase)
    if (/[a-z][A-Z]/.test(wardName)) {
      wards.add(wardName);
    }
  }

  if (wards.size > 0) {
    console.log(`Found ${wards.size} potential compound ward names:\n`);
    [...wards].sort().forEach(ward => {
      console.log(`  - ${ward}`);
    });
    console.log('\nAdd these to WARD_CORRECTIONS if they need spacing fixes.\n');
  } else {
    console.log('No obvious compound names found.\n');
  }
}

// =========================================================================
// EXECUTION
// =========================================================================

const args = process.argv.slice(2);

if (args.includes('--discover')) {
  discoverPotentialIssues();
} else {
  fixWardNames().catch(err => {
    console.error('[ERROR]', err.message);
    process.exit(1);
  });
}
