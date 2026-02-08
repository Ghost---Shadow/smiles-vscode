import initRDKitModule from '@rdkit/rdkit';

let RDKitModule = null;

/**
 * Initialize RDKit module
 */
export async function initRDKit() {
  if (!RDKitModule) {
    RDKitModule = await initRDKitModule();
  }
  return RDKitModule;
}

/**
 * Generate SVG from SMILES using RDKit
 * @param {string} smiles - SMILES string
 * @param {object} options - Rendering options
 * @returns {string} SVG string
 */
export async function generateSVG(smiles, options = {}) {
  const rdkit = await initRDKit();

  const {
    width = 500,
    height = 300,
    addStereoAnnotation = true,
  } = options;

  let mol = null;
  try {
    // console.log('[RDKit] Attempting to render SMILES:', smiles);

    // Create molecule from SMILES
    mol = rdkit.get_mol(smiles);

    if (!mol || !mol.is_valid()) {
      throw new Error(`Invalid molecule for SMILES: ${smiles}`);
    }

    // Generate SVG
    const svg = mol.get_svg_with_highlights(JSON.stringify({
      width,
      height,
      addStereoAnnotation,
    }));

    // console.log('[RDKit] Successfully rendered SMILES:', smiles);
    return svg;
  } catch (err) {
    throw new Error(`Failed to generate SVG for "${smiles}": ${err.message}`);
  } finally {
    // Clean up molecule object
    if (mol) {
      mol.delete();
    }
  }
}

/**
 * Check if SMILES is valid using RDKit
 * @param {string} smiles - SMILES string
 * @returns {boolean}
 */
export async function isValidSMILES(smiles) {
  const rdkit = await initRDKit();

  let mol = null;
  try {
    mol = rdkit.get_mol(smiles);
    return mol && mol.is_valid();
  } catch {
    return false;
  } finally {
    if (mol) {
      mol.delete();
    }
  }
}
