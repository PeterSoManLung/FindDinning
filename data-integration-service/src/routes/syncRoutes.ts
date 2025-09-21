import { Router } from 'express';
import { SyncController } from '../controllers/syncController';

const router = Router();
const syncController = new SyncController();

// Sync job management routes
router.get('/jobs', syncController.getJobs.bind(syncController));
router.get('/jobs/:jobId', syncController.getJobStatus.bind(syncController));
router.post('/jobs', syncController.createJob.bind(syncController));
router.put('/jobs/:jobId', syncController.updateJob.bind(syncController));
router.delete('/jobs/:jobId', syncController.deleteJob.bind(syncController));

// Job control routes
router.post('/jobs/:jobId/enable', syncController.enableJob.bind(syncController));
router.post('/jobs/:jobId/disable', syncController.disableJob.bind(syncController));
router.post('/jobs/:jobId/trigger', syncController.triggerManualSync.bind(syncController));

// Sync history and monitoring routes
router.get('/history', syncController.getSyncHistory.bind(syncController));
router.get('/freshness', syncController.getDataFreshness.bind(syncController));
router.get('/metrics', syncController.getSyncMetrics.bind(syncController));
router.get('/health', syncController.getHealthStatus.bind(syncController));

// Incremental update routes
router.get('/changes/:source', syncController.getIncrementalChanges.bind(syncController));
router.get('/statistics/:source', syncController.getChangeStatistics.bind(syncController));

// Alert management routes
router.get('/alerts', syncController.getAlerts.bind(syncController));
router.post('/alerts/:alertId/acknowledge', syncController.acknowledgeAlert.bind(syncController));
router.post('/alerts/:alertId/resolve', syncController.resolveAlert.bind(syncController));

export default router;