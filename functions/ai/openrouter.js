const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');

const OPENROUTER_API_KEY = defineSecret('OPENROUTER_API_KEY');
const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_BUTLER_MODEL = 'google/gemini-2.0-flash-001';
const MAX_PROMPT_LENGTH = 4000;
const MAX_HISTORY_MESSAGES = 8;

const serverTimestamp = () => admin.firestore.FieldValue.serverTimestamp();
const increment = (value) => admin.firestore.FieldValue.increment(value);
const cleanString = (value, max = 500) => String(value || '').trim().slice(0, max);

const requireString = (value, label, max = 240) => {
  const next = cleanString(value, max);
  if (!next) throw new HttpsError('invalid-argument', `${label} is required.`);
  return next;
};

const normalizeRole = (value) => (value === 'assistant' ? 'assistant' : 'user');

const inferButlerIntent = (prompt) => {
  const lower = String(prompt || '').toLowerCase();
  if (/(reply|client|chat|message|reschedule|late|follow)/.test(lower)) return 'client_reply';
  if (/(logo|colour|color|palette|scheme|brand)/.test(lower)) return 'brand_colour';
  if (/(design|theme|style|premium|luxury|page|booking page|look)/.test(lower)) return 'page_design';
  if (/(schedule|hours|availability|time|slot|week)/.test(lower)) return 'schedule';
  if (/(service|price|duration|menu|offer)/.test(lower)) return 'services';
  return 'general';
};

const compactContext = (context = {}) => ({
  workspaceName: cleanString(context.workspaceName, 140),
  workspaceRole: cleanString(context.workspaceRole, 80),
  activeArea: cleanString(context.activeArea, 80),
  bookingPageStyle: cleanString(context.bookingPageStyle, 120),
  colourDirection: cleanString(context.colourDirection, 120),
  businessType: cleanString(context.businessType, 120),
  services: Array.isArray(context.services)
    ? context.services.slice(0, 8).map((service) => ({
      name: cleanString(service?.name, 120),
      price: cleanString(service?.price, 80),
      duration: cleanString(service?.duration, 80)
    })).filter((service) => service.name)
    : []
});

const compactHistory = (messages = []) => (
  Array.isArray(messages)
    ? messages
      .slice(-MAX_HISTORY_MESSAGES)
      .map((message) => ({
        role: normalizeRole(message?.role),
        content: cleanString(message?.body || message?.content, 1200)
      }))
      .filter((message) => message.content)
    : []
);

const assertWorkspaceStaff = async ({ appId, ownerId, auth }) => {
  if (!auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in to use the Butler.');
  }
  if (auth.uid === ownerId) return;

  const email = cleanString(auth.token?.email, 220).toLowerCase();
  if (!email) {
    throw new HttpsError('permission-denied', 'This account does not have workspace access.');
  }

  const staffSnap = await admin.firestore()
    .collection('artifacts').doc(appId)
    .collection('staffAccess').doc(email)
    .collection('workspaces').doc(ownerId)
    .get();
  const staff = staffSnap.data() || {};
  if (!staffSnap.exists || staff.status !== 'active') {
    throw new HttpsError('permission-denied', 'This account does not have workspace access.');
  }
};

const createUsageTracker = async ({ appId, ownerId, uid, model, intent, promptLength }) => {
  const db = admin.firestore();
  const monthId = new Date().toISOString().slice(0, 7);
  const usageRef = db
    .collection('artifacts').doc(appId)
    .collection('users').doc(ownerId)
    .collection('ai_usage').doc(monthId);
  const eventRef = usageRef.collection('events').doc();

  await Promise.all([
    usageRef.set({
      ownerId,
      monthId,
      requestCount: increment(1),
      inFlightCount: increment(1),
      updatedAt: serverTimestamp(),
      lastRequestAt: serverTimestamp()
    }, { merge: true }),
    eventRef.set({
      ownerId,
      uid,
      model,
      intent,
      promptLength,
      status: 'started',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
  ]);

  return {
    async succeed({ usage = {}, replyLength = 0 }) {
      const inputTokens = Number(usage.prompt_tokens || usage.input_tokens || 0);
      const outputTokens = Number(usage.completion_tokens || usage.output_tokens || 0);
      const totalTokens = Number(usage.total_tokens || inputTokens + outputTokens || 0);
      await Promise.all([
        usageRef.set({
          inFlightCount: increment(-1),
          successCount: increment(1),
          inputTokens: increment(Number.isFinite(inputTokens) ? inputTokens : 0),
          outputTokens: increment(Number.isFinite(outputTokens) ? outputTokens : 0),
          totalTokens: increment(Number.isFinite(totalTokens) ? totalTokens : 0),
          updatedAt: serverTimestamp(),
          lastSuccessAt: serverTimestamp()
        }, { merge: true }),
        eventRef.set({
          status: 'succeeded',
          replyLength,
          usage: {
            inputTokens: Number.isFinite(inputTokens) ? inputTokens : 0,
            outputTokens: Number.isFinite(outputTokens) ? outputTokens : 0,
            totalTokens: Number.isFinite(totalTokens) ? totalTokens : 0
          },
          updatedAt: serverTimestamp()
        }, { merge: true })
      ]);
    },
    async fail(error) {
      await Promise.all([
        usageRef.set({
          inFlightCount: increment(-1),
          failureCount: increment(1),
          updatedAt: serverTimestamp(),
          lastFailureAt: serverTimestamp()
        }, { merge: true }),
        eventRef.set({
          status: 'failed',
          errorCode: cleanString(error?.code || 'internal', 80),
          errorMessage: cleanString(error?.message || 'Butler request failed.', 300),
          updatedAt: serverTimestamp()
        }, { merge: true })
      ]).catch((trackingError) => {
        console.error('Butler usage failure tracking failed', trackingError);
      });
    }
  };
};

const buildSystemPrompt = (context) => (
  [
    'You are Build A Booking Butler, an expert operator embedded inside a premium booking SaaS dashboard.',
    'Help business owners and staff with client replies, booking page design, colour schemes, schedule setup, service clarity, and workspace decisions.',
    'Use a concise, premium, practical voice: calm, direct, human, and action-oriented.',
    'The product aesthetic is seamless light UI: Apple iOS fluidity, Google clarity, Vercel precision, Porsche industrial restraint.',
    'Do not claim you changed data, sent a message, charged a payment, or published a page. Suggest the exact next step or draft copy instead.',
    'When useful, reference the app areas by name: Editor, Business, Bookings, Clients, Communications, Services, Profile.',
    `Workspace context: ${JSON.stringify(context)}`
  ].join('\n')
);

const callOpenRouter = async ({ apiKey, model, messages, uid }) => {
  const response = await fetch(OPENROUTER_CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://build-a-booking.web.app',
      'X-OpenRouter-Title': 'Build A Booking'
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.45,
      max_tokens: 700,
      user: uid
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const providerMessage = cleanString(payload?.error?.message || payload?.message, 300);
    if ([401, 403].includes(response.status)) {
      throw new HttpsError('failed-precondition', 'AI is not configured yet. Check the OpenRouter API key in Firebase secrets.');
    }
    if ([402, 429].includes(response.status)) {
      throw new HttpsError('resource-exhausted', providerMessage || 'OpenRouter usage is temporarily limited.');
    }
    throw new HttpsError('unavailable', providerMessage || 'OpenRouter could not complete this Butler request.');
  }

  const reply = cleanString(payload?.choices?.[0]?.message?.content, 4000);
  if (!reply) {
    throw new HttpsError('unavailable', 'OpenRouter returned an empty Butler response.');
  }
  return {
    reply,
    usage: payload.usage || {},
    model: payload.model || model
  };
};

const runButlerPrompt = onCall({
  region: 'us-central1',
  secrets: [OPENROUTER_API_KEY]
}, async (request) => {
  const apiKey = OPENROUTER_API_KEY.value() || process.env.OPENROUTER_API_KEY || '';
  if (!apiKey) {
    throw new HttpsError('failed-precondition', 'AI is not configured yet. Add OPENROUTER_API_KEY in Firebase Functions secrets.');
  }

  const appId = requireString(request.data?.appId || 'build-a-booking-v2', 'App ID', 160);
  const ownerId = requireString(request.data?.ownerId, 'Workspace owner', 160);
  const prompt = requireString(request.data?.prompt, 'Prompt', MAX_PROMPT_LENGTH);
  const model = cleanString(request.data?.model, 140) || DEFAULT_BUTLER_MODEL;
  const intent = inferButlerIntent(prompt);
  const context = compactContext(request.data?.context || {});
  const history = compactHistory(request.data?.messages || []);

  await assertWorkspaceStaff({ appId, ownerId, auth: request.auth });
  const tracker = await createUsageTracker({
    appId,
    ownerId,
    uid: request.auth.uid,
    model,
    intent,
    promptLength: prompt.length
  });

  try {
    const messages = [
      { role: 'system', content: buildSystemPrompt(context) },
      ...history,
      { role: 'user', content: prompt }
    ];
    const result = await callOpenRouter({
      apiKey,
      model,
      messages,
      uid: request.auth.uid
    });
    await tracker.succeed({ usage: result.usage, replyLength: result.reply.length });
    return {
      ok: true,
      reply: result.reply,
      model: result.model,
      usage: result.usage,
      intent
    };
  } catch (error) {
    await tracker.fail(error);
    if (error instanceof HttpsError) throw error;
    console.error('runButlerPrompt failed', error);
    throw new HttpsError('internal', error?.message || 'Butler could not complete this request.');
  }
});

module.exports = {
  runButlerPrompt
};
