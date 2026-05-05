const mongoose = require('mongoose');

/**
 * AiPrompt — editable LLM prompt stored in the database so admins can tweak
 * wording without redeploying. Each prompt is identified by a stable `key`
 * (e.g. "itinerary.generate") which the code looks up at call time.
 *
 * The defaults live alongside the code in services/promptService.js; this
 * model only persists overrides. If no document exists for a given key, the
 * service falls back to the code default.
 */
const aiPromptSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    systemPrompt: { type: String, default: '' },
    userTemplate: { type: String, default: '' },
    updatedAt: { type: Date, default: Date.now },
    updatedBy: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      email: String
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('AiPrompt', aiPromptSchema);
