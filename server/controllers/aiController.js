const axios = require('axios');
const { validationResult, matchedData } = require('express-validator');
const PDFDocument = require('pdfkit');
const EmailHistory = require('../models/EmailHistory');
const logger = require('../utils/logger');

const VALID_TONES = EmailHistory.VALID_TONES;
const VALID_STATUSES = EmailHistory.VALID_STATUSES;

const TONE_INSTRUCTIONS = {
  formal:
    'TONE: Formal and professional. Polished phrasing. No contractions. Dignified and respectful. No slang.',
  casual:
    'TONE: Casual and conversational. Warm and friendly. Contractions allowed. Approachable, like a peer-to-peer outreach between professionals.',
  persuasive:
    'TONE: Persuasive and high-signal. Lead with value. Confident, benefit-forward, urgent but not pushy. Cue data or social proof. CTA is clear and high-conviction.',
  'short-and-direct':
    'TONE: Extremely short, direct, no fluff. 40–60 words. Every sentence earns its place. No pleasantries other than the greeting, no filler. One-sentence CTA.',
};

const buildSystemPrompt = (tone = 'formal') => {
  const toneLine = TONE_INSTRUCTIONS[tone] || TONE_INSTRUCTIONS.formal;
  return `You are an expert job outreach and cold-copywriter.
Your task: generate a HIGH-CONVERTING cold outreach sequence (email + LinkedIn DM + follow-up email) tailored to the user's request.
${toneLine}

Even if the prompt is only 2-4 words, assume realistic context and DO NOT ask for clarification.

===========================
OUTPUT FORMAT (STRICT)
===========================
Return ONLY valid JSON:
{
  "subject": "",
  "emailBody": "",
  "linkedInDM": "",
  "followUpEmail": ""
}
No markdown, no explanations, no code fences. Only valid JSON.

===========================
CONTEXT ASSUMPTIONS (when not provided)
===========================
- Sender: 2+ years in software / backend or related role, strong DSA + system design, production-level work, actively looking for Software Engineer roles.
- If prompt is brief: intelligently assume the recipient, role context, and a relevant hiring pain point (scaling, reliability, perf, team growth).

===========================
SUBJECT LINE RULES
===========================
- 6–9 words
- Confident
- Not generic
- Highlights value

===========================
EMAIL BODY RULES
===========================
- 60–90 words (except short-and-direct: 40–60 words)
- Personalized observation
- Concise, structured
- Clear CTA
- No emojis, no hype

===========================
LINKEDIN DM RULES
===========================
- 30–50 words. Short conversational. Observation + value + soft ask.

===========================
FOLLOW-UP EMAIL RULES
===========================
- 50–80 words
- New angle; emphasize long-term value; professional urgency; clear CTA.

Return ONLY valid JSON.`;
};

const buildFullPrompt = (userPrompt, tone) => {
  const clean = typeof userPrompt === 'string' ? userPrompt.trim() : '';
  return `${buildSystemPrompt(tone)}\n\nUser REQUEST: "${clean}"\n\nReturn ONLY valid JSON.`;
};

const callGroq = async (prompt, tone) => {
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) throw new Error('AI service is not configured');
  const aiResponse = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: buildFullPrompt(prompt, tone) }],
      temperature: 0.7,
      max_tokens: 1024,
    },
    {
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );
  if (!aiResponse.data?.choices?.[0]?.message) throw new Error('Invalid response from Groq API');
  const generatedText = aiResponse.data.choices[0].message.content;
  const jsonMatch = typeof generatedText === 'string' ? generatedText.match(/\{[\s\S]*\}/) : null;
  let parsed;
  try {
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(generatedText);
  } catch (parseError) {
    logger.error({ generatedText: String(generatedText).slice(0, 500) }, 'AI JSON parse error');
    throw new Error('The AI generated invalid JSON. Please try again.');
  }
  return {
    subject: typeof parsed.subject === 'string' ? parsed.subject.trim() : (parsed.subject || 'New Opportunity'),
    emailBody: typeof parsed.emailBody === 'string' ? parsed.emailBody.trim() : (parsed.emailBody || ''),
    linkedInDM: typeof parsed.linkedInDM === 'string' ? parsed.linkedInDM.trim() : (parsed.linkedInDM ?? ''),
    followUpEmail: typeof parsed.followUpEmail === 'string' ? parsed.followUpEmail.trim() : (parsed.followUpEmail ?? ''),
  };
};

const sendValidation = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.info({ errors: errors.array(), path: req.originalUrl }, 'AI route validation failed');
    return res.status(400).json({
      message: 'Validation failed',
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  return null;
};

const ensureOwnership = async (userId, historyId) => {
  try {
    return await EmailHistory.findOne({ _id: historyId, userId });
  } catch (err) {
    if (err.name === 'CastError') return null;
    throw err;
  }
};

exports.generateEmail = async (req, res) => {
  const err = sendValidation(req, res);
  if (err) return err;
  try {
    const { prompt, tone = 'formal', numVariants = 1, templateId } = matchedData(req);
    const rawCount = Number.isFinite(+numVariants) ? +numVariants : 1;
    const variantsCount = Math.min(Math.max(Math.floor(rawCount), 1), 3);
    logger.info({ userId: req.user._id, tone, variantsCount }, 'AI generate request');

    const first = await callGroq(prompt, tone);
    const variants = [];
    for (let i = 1; i < variantsCount; i++) {
      try {
        const v = await callGroq(prompt, tone);
        variants.push({
          variantId: `v-${i + 1}`,
          subject: v.subject,
          emailBody: v.emailBody,
          linkedInDM: v.linkedInDM,
          followUpEmail: v.followUpEmail,
          selected: false,
        });
      } catch (variantErr) {
        logger.warn({ error: variantErr.message }, 'Variant generation failed');
      }
    }

    const historyEntry = await EmailHistory.create({
      userId: req.user._id,
      prompt: prompt.trim(),
      tone,
      templateId: templateId || undefined,
      subject: first.subject,
      emailBody: first.emailBody,
      linkedInDM: first.linkedInDM,
      followUpEmail: first.followUpEmail,
      variants: variants.length ? variants : undefined,
    });

    logger.info({ historyId: historyEntry._id }, 'Email sequence generated');
    return res.status(200).json(historyEntry);
  } catch (error) {
    logger.error(
      { error: error.message, stack: error.stack, upstream: error.response?.data || null, userId: req.user?._id },
      'AI generation failed'
    );
    if (error.response?.status === 429) {
      return res.status(429).json({ message: 'AI provider rate limited. Try again shortly.' });
    }
    return res.status(500).json({
      message: error.message && error.message.includes('JSON')
        ? error.message
        : 'Failed to generate email',
    });
  }
};

exports.getHistory = async (req, res) => {
  const err = sendValidation(req, res);
  if (err) return err;
  try {
    const { search, tag, tone, favorite, status, limit = 50, offset = 0 } = matchedData(req);
    const query = { userId: req.user._id };
    if (favorite === 'true') query.isFavorite = true;
    if (tone && VALID_TONES.includes(tone)) query.tone = tone;
    if (status && VALID_STATUSES.includes(status)) query.status = status;
    if (tag) query.tags = String(tag);
    if (search) query.$text = { $search: String(search) };

    const sort = search ? { score: { $meta: 'textScore' } } : { createdAt: -1 };
    const projection = search ? { score: { $meta: 'textScore' } } : undefined;

    const pageLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const pageOffset = Math.max(parseInt(offset, 10) || 0, 0);

    const [items, total] = await Promise.all([
      EmailHistory.find(query, projection)
        .sort(sort)
        .skip(pageOffset)
        .limit(pageLimit)
        .select('-__v')
        .lean(),
      EmailHistory.countDocuments(query),
    ]);

    return res.status(200).json({ items, total, count: total, limit: pageLimit, offset: pageOffset });
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'History fetch failed');
    return res.status(500).json({ message: 'Failed to fetch history' });
  }
};

exports.getHistoryById = async (req, res) => {
  try {
    const entry = await ensureOwnership(req.user._id, req.params.id);
    if (!entry) return res.status(404).json({ message: 'Entry not found' });
    return res.status(200).json(entry);
  } catch (error) {
    logger.error({ error: error.message }, 'History get by id failed');
    return res.status(500).json({ message: 'Failed to fetch entry' });
  }
};

exports.updateHistory = async (req, res) => {
  const err = sendValidation(req, res);
  if (err) return err;
  try {
    const entry = await ensureOwnership(req.user._id, req.params.id);
    if (!entry) return res.status(404).json({ message: 'Entry not found' });
    const data = matchedData(req);

    if (typeof data.subject === 'string') entry.subject = data.subject.trim();
    if (typeof data.emailBody === 'string') entry.emailBody = data.emailBody;
    if (typeof data.linkedInDM === 'string') entry.linkedInDM = data.linkedInDM;
    if (typeof data.followUpEmail === 'string') entry.followUpEmail = data.followUpEmail;
    if (typeof data.tone === 'string' && VALID_TONES.includes(data.tone)) entry.tone = data.tone;
    if (Array.isArray(data.tags)) entry.tags = data.tags.filter((t) => typeof t === 'string');
    if (typeof data.isFavorite === 'boolean') entry.isFavorite = data.isFavorite;
    if (typeof data.status === 'string' && VALID_STATUSES.includes(data.status)) {
      entry.status = data.status;
      if (data.status === 'sent' && !entry.sentAt) entry.sentAt = new Date();
      if (data.status === 'replied' && !entry.repliedAt) entry.repliedAt = new Date();
    }

    if (Array.isArray(data.variants)) {
      const cleanVariants = data.variants
        .filter((v) => v && typeof v === 'object')
        .slice(0, 5)
        .map((raw, i) => {
          const existing = Array.isArray(entry.variants) ? entry.variants[i] || {} : {};
          const variantId = typeof raw.variantId === 'string' ? raw.variantId.slice(0, 50) : existing.variantId || `v-${i + 1}`;
          const subject = typeof raw.subject === 'string' ? raw.subject.trim().slice(0, 500) : (typeof existing.subject === 'string' ? existing.subject : '');
          const emailBody = typeof raw.emailBody === 'string' ? raw.emailBody.slice(0, 20000) : (typeof existing.emailBody === 'string' ? existing.emailBody : '');
          const linkedInDM = typeof raw.linkedInDM === 'string' ? raw.linkedInDM.slice(0, 5000) : (typeof existing.linkedInDM === 'string' ? existing.linkedInDM : '');
          const followUpEmail = typeof raw.followUpEmail === 'string' ? raw.followUpEmail.slice(0, 20000) : (typeof existing.followUpEmail === 'string' ? existing.followUpEmail : '');
          const selected = typeof raw.selected === 'boolean' ? raw.selected : Boolean(existing.selected);
          return { variantId, subject, emailBody, linkedInDM, followUpEmail, selected };
        });

      if (cleanVariants.length > 0) {
        const anySelected = cleanVariants.some((v) => v.selected);
        if (!anySelected) cleanVariants[0].selected = true;
        entry.variants = cleanVariants;

        const primary = cleanVariants.find((v) => v.selected) || cleanVariants[0];
        if (!('subject' in data) && primary.subject) entry.subject = primary.subject;
        if (!('emailBody' in data) && primary.emailBody) entry.emailBody = primary.emailBody;
        if (!('linkedInDM' in data)) entry.linkedInDM = primary.linkedInDM || entry.linkedInDM;
        if (!('followUpEmail' in data)) entry.followUpEmail = primary.followUpEmail || entry.followUpEmail;
      }
    }

    await entry.save();
    logger.info({ historyId: entry._id }, 'History entry updated');
    return res.status(200).json(entry);
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'History update failed');
    return res.status(500).json({ message: 'Failed to update entry' });
  }
};

exports.toggleFavorite = async (req, res) => {
  try {
    const entry = await ensureOwnership(req.user._id, req.params.id);
    if (!entry) return res.status(404).json({ message: 'Entry not found' });
    entry.isFavorite = !entry.isFavorite;
    await entry.save();
    return res.status(200).json({ _id: entry._id, isFavorite: entry.isFavorite });
  } catch (error) {
    logger.error({ error: error.message }, 'Toggle favorite failed');
    return res.status(500).json({ message: 'Failed to toggle favorite' });
  }
};

exports.deleteHistory = async (req, res) => {
  try {
    const result = await EmailHistory.deleteOne({ _id: req.params.id, userId: req.user._id });
    if (result.deletedCount === 0) return res.status(404).json({ message: 'Entry not found' });
    logger.info({ historyId: req.params.id }, 'History entry deleted');
    return res.status(200).json({ message: 'Entry deleted', _id: req.params.id });
  } catch (error) {
    logger.error({ error: error.message }, 'Delete history failed');
    return res.status(500).json({ message: 'Failed to delete entry' });
  }
};

exports.exportHistory = async (req, res) => {
  const err = sendValidation(req, res);
  if (err) return err;
  try {
    const { format = 'txt' } = matchedData(req);
    const entry = await ensureOwnership(req.user._id, req.params.id);
    if (!entry) return res.status(404).json({ message: 'Entry not found' });

    const safeSubject = (entry.subject || 'cold-email')
      .replace(/[^a-z0-9\-_ ]+/gi, '_')
      .slice(0, 60)
      .trim() || 'cold-email';
    const fileName = `${safeSubject}-${entry._id}`;

    const buildTextBundle = () =>
      `Subject: ${entry.subject}\nTone: ${entry.tone || 'formal'}\nGenerated: ${new Date(
        entry.createdAt
      ).toISOString()}\n\n=== COLD EMAIL ===\n${entry.emailBody}\n\n=== LINKEDIN DM ===\n${
        entry.linkedInDM || '(not provided)'
      }\n\n=== FOLLOW-UP EMAIL ===\n${entry.followUpEmail || '(not provided)'}\n`;

    if (format === 'txt') {
      const text = buildTextBundle();
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}.txt"`);
      return res.send(text);
    }

    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}.pdf"`);
      const doc = new PDFDocument({ margin: 56, size: 'A4', info: { Title: entry.subject || 'Cold Outreach Sequence' } });
      doc.pipe(res);

      doc.fontSize(22).text('Cold Outreach Sequence', { underline: true }).moveDown(0.4);
      doc
        .fontSize(10)
        .fillColor('#555')
        .text(
          `Generated ${new Date(entry.createdAt).toLocaleString()}  •  Tone: ${entry.tone || 'formal'}`
        );
      doc.moveDown(1).fillColor('#000');

      doc.fontSize(14).text('Subject:', { continued: true }).fontSize(12).text(` ${entry.subject}`).moveDown(1);

      doc.fontSize(14).fillColor('#C2410C').text('Cold Email').fillColor('#000').moveDown(0.3);
      doc.fontSize(11).text(entry.emailBody || '', { paragraphGap: 6, lineGap: 3 }).moveDown(1.2);

      doc.fontSize(14).fillColor('#C2410C').text('LinkedIn DM').fillColor('#000').moveDown(0.3);
      doc.fontSize(11).text(entry.linkedInDM || '(empty)', { paragraphGap: 6, lineGap: 3 }).moveDown(1.2);

      doc.fontSize(14).fillColor('#C2410C').text('Follow-Up Email').fillColor('#000').moveDown(0.3);
      doc.fontSize(11).text(entry.followUpEmail || '(empty)', { paragraphGap: 6, lineGap: 3 });

      doc.end();
      return;
    }

    return res.status(400).json({ message: 'Unsupported export format. Use txt or pdf.' });
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Export failed');
    return res.status(500).json({ message: 'Export failed' });
  }
};

const TONE_LABELS = {
  formal: 'Formal',
  casual: 'Casual',
  persuasive: 'Persuasive',
  'short-and-direct': 'Short & direct',
};

exports.getTones = (_req, res) => {
  return res.status(200).json({
    tones: VALID_TONES.map((t) => ({
      id: t,
      label: TONE_LABELS[t] || t,
      description: TONE_INSTRUCTIONS[t].replace(/^TONE:\s*/, ''),
    })),
  });
};
