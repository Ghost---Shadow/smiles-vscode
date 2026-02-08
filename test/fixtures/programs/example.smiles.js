/**
 * Example smiles-js file for testing VSCode extension
 * Tests molecular structure visualization with JavaScript syntax
 */

import { Fragment } from 'smiles-js';

// Simple fragments
export const methane = Fragment('C');
export const ethane = Fragment('CC');
export const propane = Fragment('CCC');

// Functional groups
export const water = Fragment('O');
export const ammonia = Fragment('N');

// Aromatic compounds
export const benzene = Fragment('c1ccccc1');
export const toluene = Fragment('Cc1ccccc1');

// Branched molecules
export const ethanol = Fragment('CCO');
export const aceticAcid = Fragment('CC(=O)O');

// Aspirin with proper multi-substituted benzene notation
export const aspirin = Fragment('c1c(C(=O)O)cccc1OC(=O)C');

// Complex molecules - using proper SMILES notation for multi-substituted benzene
export const ibuprofen = Fragment('c1c(CC(C)C)ccc(CC(C)C(=O)O)c1');
