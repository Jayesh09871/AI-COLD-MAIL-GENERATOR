const express = require('express');
const { body, query, param } = require('express-validator');
const router = express.Router();
const {
  generateEmail,
  getHistory,
  getHistoryById,
  updateHistory,
  toggleFavorite,
  deleteHistory,
  exportHistory,
  getTones,
} = require('../controllers/aiController');
const { protect } = require('../middleware/authMiddleware');
const { generateLimiter, historyReadLimiter, apiLimiter } = require('../middleware/rateLimit');
const EmailHistory = require('../models/EmailHistory');

const VALID_TONES = EmailHistory.VALID_TONES;
const VALID_STATUSES = EmailHistory.VALID_STATUSES;

router.use(protect);
router.use(apiLimiter);

router.get('/tones', getTones);

router.post(
  '/generate-email',
  generateLimiter,
  [
    body('prompt')
      .exists({ checkFalsy: true })
      .withMessage('Prompt is required')
      .isString()
      .withMessage('Prompt must be a string')
      .trim()
      .notEmpty()
      .withMessage('Prompt cannot be empty')
      .isLength({ min: 1, max: 2000 })
      .withMessage('Prompt must be between 1 and 2000 characters'),
    body('tone')
      .optional()
      .isString()
      .withMessage('Tone must be a string')
      .trim()
      .isIn(VALID_TONES)
      .withMessage(`Tone must be one of: ${VALID_TONES.join(', ')}`),
    body('numVariants')
      .optional()
      .isInt({ min: 1, max: 3 })
      .withMessage('numVariants must be an integer between 1 and 3'),
    body('templateId')
      .optional()
      .isString()
      .withMessage('templateId must be a string')
      .trim()
      .isLength({ min: 1, max: 100 }),
  ],
  generateEmail
);

router.get(
  '/history',
  historyReadLimiter,
  [
    query('search').optional().isString().trim().isLength({ min: 1, max: 200 }),
    query('tag').optional().isString().trim().isLength({ min: 1, max: 50 }),
    query('tone').optional().isString().trim().isIn(VALID_TONES),
    query('favorite').optional().isIn(['true', 'false']),
    query('status').optional().isString().trim().isIn(VALID_STATUSES),
    query('limit').optional().isInt({ min: 1, max: 200 }),
    query('offset').optional().isInt({ min: 0 }),
  ],
  getHistory
);

router.get(
  '/history/:id',
  [param('id').isMongoId().withMessage('Invalid history id')],
  getHistoryById
);

router.patch(
  '/history/:id',
  [
    param('id').isMongoId().withMessage('Invalid history id'),
    body('subject').optional().isString().trim().isLength({ min: 1, max: 500 }),
    body('emailBody').optional().isString().isLength({ min: 1, max: 20000 }),
    body('linkedInDM').optional().isString().isLength({ min: 0, max: 5000 }),
    body('followUpEmail').optional().isString().isLength({ min: 0, max: 20000 }),
    body('tone').optional().isString().trim().isIn(VALID_TONES),
    body('tags')
      .optional()
      .isArray({ max: 20 })
      .withMessage('tags must be an array of up to 20 strings'),
    body('tags.*').optional().isString().trim().isLength({ min: 1, max: 50 }),
    body('isFavorite').optional().isBoolean().withMessage('isFavorite must be a boolean'),
    body('status').optional().isString().trim().isIn(VALID_STATUSES),
    body('variants')
      .optional()
      .isArray({ max: 5 })
      .withMessage('variants must be an array of up to 5 objects'),
    body('variants.*').optional().isObject().withMessage('each variant must be an object'),
    body('variants.*.variantId').optional().isString().trim().isLength({ min: 1, max: 50 }),
    body('variants.*.subject').optional().isString().trim().isLength({ min: 1, max: 500 }),
    body('variants.*.emailBody').optional().isString().isLength({ min: 1, max: 20000 }),
    body('variants.*.linkedInDM').optional().isString().isLength({ min: 0, max: 5000 }),
    body('variants.*.followUpEmail').optional().isString().isLength({ min: 0, max: 20000 }),
    body('variants.*.selected').optional().isBoolean(),
  ],
  updateHistory
);

router.post(
  '/history/:id/favorite',
  [param('id').isMongoId().withMessage('Invalid history id')],
  toggleFavorite
);

router.delete(
  '/history/:id',
  [param('id').isMongoId().withMessage('Invalid history id')],
  deleteHistory
);

router.get(
  '/history/:id/export',
  [
    param('id').isMongoId().withMessage('Invalid history id'),
    query('format').optional().isString().trim().isIn(['txt', 'pdf']).withMessage('format must be txt or pdf'),
  ],
  exportHistory
);

module.exports = router;
