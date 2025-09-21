import { Router } from 'express';
import {
  extractFromAllPlatforms,
  extractFromPlatforms,
  extractFromPlatform,
  extractRestaurantFromAllPlatforms,
  getPlatformHealthStatus,
  getPlatformSummary,
  getJobStatus,
  cancelJob
} from '../controllers/platformExtractionController';

const router = Router();

/**
 * @route POST /api/platform-extraction/extract-all
 * @desc Extract data from all Hong Kong platforms
 * @body {
 *   batchSize?: number,
 *   maxConcurrency?: number,
 *   retryFailedSources?: boolean,
 *   skipHealthCheck?: boolean
 * }
 */
router.post('/extract-all', extractFromAllPlatforms);

/**
 * @route POST /api/platform-extraction/extract
 * @desc Extract data from specific platforms
 * @body {
 *   sources: DataSourceEnum[],
 *   batchSize?: number,
 *   maxConcurrency?: number,
 *   retryFailedSources?: boolean,
 *   skipHealthCheck?: boolean
 * }
 */
router.post('/extract', extractFromPlatforms);

/**
 * @route GET /api/platform-extraction/extract/:source
 * @desc Extract data from a single platform
 * @params source - DataSourceEnum
 * @query {
 *   limit?: number,
 *   offset?: number,
 *   district?: string,
 *   city?: string,
 *   location?: string
 * }
 */
router.get('/extract/:source', extractFromPlatform);

/**
 * @route POST /api/platform-extraction/extract-restaurant
 * @desc Extract specific restaurant from all platforms
 * @body {
 *   restaurantName: string,
 *   location?: string
 * }
 */
router.post('/extract-restaurant', extractRestaurantFromAllPlatforms);

/**
 * @route GET /api/platform-extraction/health
 * @desc Get platform health status
 */
router.get('/health', getPlatformHealthStatus);

/**
 * @route GET /api/platform-extraction/summary
 * @desc Get platform configuration summary
 */
router.get('/summary', getPlatformSummary);

/**
 * @route GET /api/platform-extraction/job/:jobId/status
 * @desc Get extraction job status
 * @params jobId - string
 */
router.get('/job/:jobId/status', getJobStatus);

/**
 * @route POST /api/platform-extraction/job/:jobId/cancel
 * @desc Cancel extraction job
 * @params jobId - string
 */
router.post('/job/:jobId/cancel', cancelJob);

export default router;