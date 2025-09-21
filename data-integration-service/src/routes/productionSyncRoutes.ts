import { Router } from 'express';
import { ProductionSyncController } from '../controllers/productionSyncController';
import { ScheduledSyncService } from '../services/ScheduledSyncService';
import { SyncMonitoringService } from '../services/SyncMonitoringService';
import { DataIntegrationFramework } from '../services/DataIntegrationFramework';
import { DataValidationService } from '../services/DataValidationService';
import { DeduplicationService } from '../services/DeduplicationService';

const router = Router();

// Initialize services
const dataIntegration = new DataIntegrationFramework();
const validation = new DataValidationService();
const deduplication = new DeduplicationService();
const scheduledSyncService = new ScheduledSyncService(dataIntegration, validation, deduplication);
const monitoringService = new SyncMonitoringService();

// Initialize controller
const productionSyncController = new ProductionSyncController(scheduledSyncService, monitoringService);

/**
 * @swagger
 * /api/production-sync/emergency:
 *   post:
 *     summary: Trigger emergency manual sync
 *     description: Triggers an emergency sync for all Hong Kong platforms with enhanced monitoring
 *     tags: [Production Sync]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for emergency sync
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, critical]
 *                 default: high
 *     responses:
 *       200:
 *         description: Emergency sync triggered successfully
 *       400:
 *         description: Invalid request parameters
 *       500:
 *         description: Internal server error
 */
router.post('/emergency', productionSyncController.triggerEmergencySync.bind(productionSyncController));

/**
 * @swagger
 * /api/production-sync/health:
 *   get:
 *     summary: Get comprehensive system health status
 *     description: Returns detailed health information including sync status, data freshness, alerts, and backup status
 *     tags: [Production Sync]
 *     responses:
 *       200:
 *         description: System health status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     overall:
 *                       type: string
 *                       enum: [healthy, warning, critical]
 *                     healthScore:
 *                       type: number
 *                       minimum: 0
 *                       maximum: 100
 *                     activeAlerts:
 *                       type: array
 *                     dataFreshness:
 *                       type: array
 *                     recentSyncs:
 *                       type: array
 *                     backup:
 *                       type: object
 */
router.get('/health', productionSyncController.getSystemHealth.bind(productionSyncController));

/**
 * @swagger
 * /api/production-sync/lineage/{entityType}/{entityId}:
 *   get:
 *     summary: Get data lineage report for a specific entity
 *     description: Returns comprehensive lineage information including data sources, changes, and quality metrics
 *     tags: [Data Lineage]
 *     parameters:
 *       - in: path
 *         name: entityType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [restaurant, review, user, metadata]
 *       - in: path
 *         name: entityId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lineage report retrieved successfully
 *       400:
 *         description: Invalid parameters
 *       404:
 *         description: Entity not found
 *       500:
 *         description: Internal server error
 */
router.get('/lineage/:entityType/:entityId', productionSyncController.getDataLineage.bind(productionSyncController));

/**
 * @swagger
 * /api/production-sync/lineage/export/{entityId}:
 *   get:
 *     summary: Export data lineage for compliance
 *     description: Exports lineage data in JSON or CSV format for audit and compliance purposes
 *     tags: [Data Lineage]
 *     parameters:
 *       - in: path
 *         name: entityId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *           default: json
 *     responses:
 *       200:
 *         description: Lineage data exported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *           text/csv:
 *             schema:
 *               type: string
 *       400:
 *         description: Invalid parameters
 *       500:
 *         description: Internal server error
 */
router.get('/lineage/export/:entityId', productionSyncController.exportLineageData.bind(productionSyncController));

/**
 * @swagger
 * /api/production-sync/lineage/statistics:
 *   get:
 *     summary: Get lineage statistics
 *     description: Returns aggregated statistics about data lineage records
 *     tags: [Data Lineage]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Lineage statistics retrieved successfully
 *       500:
 *         description: Internal server error
 */
router.get('/lineage/statistics', productionSyncController.getLineageStatistics.bind(productionSyncController));

/**
 * @swagger
 * /api/production-sync/backup:
 *   post:
 *     summary: Create manual backup
 *     description: Creates a full or incremental backup of data
 *     tags: [Data Backup]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [full, incremental]
 *                 default: full
 *               sources:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [openrice, eatigo, chope, keeta, foodpanda, bistrochat, tripadvisor, hk_gov]
 *     responses:
 *       200:
 *         description: Backup created successfully
 *       400:
 *         description: Invalid request parameters
 *       500:
 *         description: Internal server error
 */
router.post('/backup', productionSyncController.createBackup.bind(productionSyncController));

/**
 * @swagger
 * /api/production-sync/backup:
 *   get:
 *     summary: List available backups
 *     description: Returns a list of available backups with metadata
 *     tags: [Data Backup]
 *     parameters:
 *       - in: query
 *         name: source
 *         schema:
 *           type: string
 *           enum: [openrice, eatigo, chope, keeta, foodpanda, bistrochat, tripadvisor, hk_gov]
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [full, incremental]
 *     responses:
 *       200:
 *         description: Backups listed successfully
 *       500:
 *         description: Internal server error
 */
router.get('/backup', productionSyncController.listBackups.bind(productionSyncController));

/**
 * @swagger
 * /api/production-sync/backup/restore:
 *   post:
 *     summary: Restore from backup
 *     description: Restores data from a specific backup
 *     tags: [Data Backup]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - backupId
 *               - targetEnvironment
 *             properties:
 *               backupId:
 *                 type: string
 *               targetEnvironment:
 *                 type: string
 *               validateIntegrity:
 *                 type: boolean
 *                 default: true
 *               dryRun:
 *                 type: boolean
 *                 default: false
 *               conflictResolution:
 *                 type: string
 *                 enum: [overwrite, merge, skip]
 *                 default: merge
 *     responses:
 *       200:
 *         description: Restore completed successfully
 *       400:
 *         description: Invalid request parameters
 *       500:
 *         description: Internal server error
 */
router.post('/backup/restore', productionSyncController.restoreFromBackup.bind(productionSyncController));

/**
 * @swagger
 * /api/production-sync/cleanup:
 *   post:
 *     summary: Clean up expired data
 *     description: Removes expired backups and lineage records according to retention policies
 *     tags: [Data Management]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [all, backups, lineage]
 *                 default: all
 *     responses:
 *       200:
 *         description: Cleanup completed successfully
 *       500:
 *         description: Internal server error
 */
router.post('/cleanup', productionSyncController.cleanupExpiredData.bind(productionSyncController));

export default router;