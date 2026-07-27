const mongoose = require('mongoose');

const VALID_TONES = ['formal', 'casual', 'persuasive', 'short-and-direct'];
const VALID_STATUSES = ['draft', 'sent', 'replied', 'archived'];

const variantSchema = new mongoose.Schema(
  {
    variantId: { type: String, required: true },
    subject: { type: String, required: true },
    emailBody: { type: String, required: true },
    linkedInDM: { type: String, default: '' },
    followUpEmail: { type: String, default: '' },
    selected: { type: Boolean, default: false },
  },
  { _id: false, timestamps: false }
);

const emailHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    prompt: { type: String, required: true, trim: true, maxlength: 5000 },
    tone: {
      type: String,
      enum: VALID_TONES,
      default: 'formal',
      index: true,
    },
    templateId: { type: String, index: true },
    subject: { type: String, required: true, trim: true, maxlength: 500 },
    emailBody: { type: String, required: true, maxlength: 20000 },
    linkedInDM: { type: String, default: '', maxlength: 5000 },
    followUpEmail: { type: String, default: '', maxlength: 20000 },
    variants: { type: [variantSchema], default: undefined },
    tags: {
      type: [
        {
          type: String,
          trim: true,
          maxlength: 50,
        },
      ],
      default: [],
      index: true,
    },
    isFavorite: { type: Boolean, default: false, index: true },
    status: {
      type: String,
      enum: VALID_STATUSES,
      default: 'draft',
      index: true,
    },
    sentAt: { type: Date },
    repliedAt: { type: Date },
  },
  { timestamps: true }
);

emailHistorySchema.index({ userId: 1, createdAt: -1 });
emailHistorySchema.index({ userId: 1, isFavorite: 1 });
emailHistorySchema.index({ userId: 1, status: 1 });
emailHistorySchema.index({ userId: 1, tags: 1 });

emailHistorySchema.index(
  { userId: 1, prompt: 'text', subject: 'text', emailBody: 'text' },
  {
    name: 'search_text',
    weights: { subject: 3, prompt: 2, emailBody: 1 },
  }
);

const EmailHistory = mongoose.model('EmailHistory', emailHistorySchema);
EmailHistory.VALID_TONES = VALID_TONES;
EmailHistory.VALID_STATUSES = VALID_STATUSES;
module.exports = EmailHistory;
