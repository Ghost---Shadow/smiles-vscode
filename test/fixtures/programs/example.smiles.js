/**
 * Example smiles-js file for testing VSCode extension
 * Tests molecular structure visualization with JavaScript syntax
 *
 * Note: For multi-substituted aromatic rings, use explicit position notation:
 * - Correct: Fragment('c1c(substituent1)cc(substituent2)cc1')
 * - Incorrect: benzene(substituent1)(substituent2) generates c1ccccc1(sub1)(sub2)
 * The incorrect form works in smiles-drawer but fails in RDKit validation.
 */

import { Fragment, Ring } from 'smiles-js';
import {
  methyl, ethyl, hydroxyl, carboxyl,
} from 'smiles-js/common';

// Simple fragments
export const methane = Fragment('C');
export const ethane = Fragment('CC');
export const propane = Fragment('CCC');

// Functional groups
export const water = Fragment('O');
export const ammonia = Fragment('N');

// Using Ring constructor
export const benzeneRing = Ring('c', 6);
export const toluene = benzeneRing(methyl);

// Branched molecules
export const ethanol = ethyl(hydroxyl);
export const carboxyl2 = carboxyl;
export const carbolicAcid = Fragment('OC(=O)C');
// Aspirin with proper multi-substituted benzene notation
export const aspirin = Fragment('c1c(C(=O)O)cccc1OC(=O)C');

// Complex molecules - using proper SMILES notation for multi-substituted benzene
// Instead of benzene(sub1)(sub2) which creates invalid SMILES like c1ccccc1(sub1)(sub2),
// we use explicit position notation: c1c(sub1)cc(sub2)cc1
export const ibuprofen = Fragment('c1c(CC(C)C)ccc(CC(C)C(=O)O)c1');
