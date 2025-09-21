import { Router } from 'express';
import {
  updateAtmosphere,
  updateSpecialFeatures,
  updateLocalGemStatus,
  addMenuHighlight,
  updateMenuHighlight,
  removeMenuHighlight,
  getMenuHighlights,
  addSeasonalOffering,
  getMetadataSummary
} from '../controllers/metadataController';

const router = Router();

// Restaurant metadata management
router.get('/:id/summary', getMetadataSummary);

// Atmosphere management
router.put('/:id/atmosphere', updateAtmosphere);

// Special features management
router.put('/:id/features', updateSpecialFeatures);

// Local gem status management
router.put('/:id/local-gem', updateLocalGemStatus);

// Menu highlights management
router.get('/:id/menu-highlights', getMenuHighlights);
router.post('/:id/menu-highlights', addMenuHighlight);
router.put('/:id/menu-highlights/:itemId', updateMenuHighlight);
router.delete('/:id/menu-highlights/:itemId', removeMenuHighlight);

// Seasonal offerings management
router.post('/:id/seasonal-offerings', addSeasonalOffering);

export default router;