const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');

admin.initializeApp();

const db = admin.firestore();
const serverTimestamp = () => admin.firestore.FieldValue.serverTimestamp();

const cleanString = (value, max = 240) => (
  String(value || '').trim().slice(0, max)
);

const requireString = (value, label, max = 240) => {
  const next = cleanString(value, max);
  if (!next) throw new HttpsError('invalid-argument', `${label} is required.`);
  return next;
};

const safeLockId = (dateKey, time) => (
  `${cleanString(dateKey, 32)}_${cleanString(time, 32)}`
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 120)
);

const safeDocumentId = (value, max = 180) => (
  cleanString(value, max)
    .replace(/[^a-zA-Z0-9@._:-]/g, '-')
    .slice(0, max) || `id-${Date.now()}`
);

const safeThreadId = (ownerId, bookingId) => (
  `${cleanString(ownerId, 80)}_${cleanString(bookingId, 80)}`
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 160)
);

exports.createPublicBookingRequest = onCall({ region: 'us-central1' }, async (request) => {
  const appId = requireString(request.data?.appId, 'App ID', 120);
  const workspaceSlug = requireString(request.data?.workspaceSlug, 'Workspace slug', 120).toLowerCase();
  const incoming = request.data?.booking || {};
  const idempotencyKey = cleanString(request.data?.idempotencyKey || incoming.idempotencyKey, 180);

  const clientName = requireString(incoming.clientName, 'Client name', 120);
  const clientPhone = cleanString(incoming.clientPhone, 60);
  const clientEmail = cleanString(incoming.clientEmail, 160).toLowerCase();
  const clientEmailOptIn = Boolean(incoming.clientEmailOptIn && clientEmail);
  const clientBirthday = cleanString(incoming.clientBirthday, 80);
  const clientNote = cleanString(incoming.clientNote, 1000);
  const serviceId = cleanString(incoming.serviceId, 120);
  const serviceName = cleanString(incoming.serviceName, 180);
  const serviceDescription = cleanString(incoming.serviceDescription, 700);
  const servicePrice = cleanString(incoming.servicePrice, 80);
  const servicePriceType = cleanString(incoming.servicePriceType, 40);
  const serviceDuration = cleanString(incoming.serviceDuration, 80);
  const serviceCategory = cleanString(incoming.serviceCategory, 120);
  const date = requireString(incoming.date, 'Booking date', 120);
  const dateKey = cleanString(incoming.dateKey, 32);
  const time = requireString(incoming.time, 'Booking time', 80);
  const allowedStatuses = new Set(['pending', 'confirmed', 'waitlist']);
  const status = allowedStatuses.has(incoming.status) ? incoming.status : 'pending';
  const paymentMethod = cleanString(incoming.paymentMethod, 60).toLowerCase();
  const paymentGateway = cleanString(incoming.paymentGateway || paymentMethod, 60).toLowerCase();
  const paymentProviderName = cleanString(incoming.paymentProviderName, 120);
  const isManualPayment = ['manual_eft', 'cash'].includes(paymentMethod) || ['manual_eft', 'cash'].includes(paymentGateway);
  const paymentStatus = isManualPayment ? 'manual_pending' : 'unpaid';
  const notificationChannels = {
    email: clientEmailOptIn,
    portal: Boolean(clientEmail)
  };

  const workspaceRef = db
    .collection('artifacts').doc(appId)
    .collection('public').doc('data')
    .collection('workspaces').doc(workspaceSlug);

  const workspaceSnap = await workspaceRef.get();
  if (!workspaceSnap.exists) {
    throw new HttpsError('not-found', 'This booking page is not published yet.');
  }

  const workspace = workspaceSnap.data() || {};
  const ownerId = workspace.ownerId;
  if (!ownerId) {
    throw new HttpsError('failed-precondition', 'This booking page is missing an owner.');
  }

  const bookingRef = db
    .collection('artifacts').doc(appId)
    .collection('users').doc(ownerId)
    .collection('bookings').doc();
  const publicSubmissionRef = workspaceRef.collection('bookingSubmissions').doc(bookingRef.id);
  const notificationRef = db
    .collection('artifacts').doc(appId)
    .collection('notificationJobs').doc();
  const ownerNotificationRef = db
    .collection('artifacts').doc(appId)
    .collection('users').doc(ownerId)
    .collection('notifications').doc();
  const threadId = safeThreadId(ownerId, bookingRef.id);
  const threadRef = db
    .collection('artifacts').doc(appId)
    .collection('clientThreads').doc(threadId);
  const initialMessageRef = threadRef.collection('messages').doc();
  const clientAccessRef = clientEmail
    ? db
      .collection('artifacts').doc(appId)
      .collection('clientAccess').doc(clientEmail)
      .collection('bookings').doc(bookingRef.id)
    : null;
  const clientNotificationRef = clientEmail
    ? db
      .collection('artifacts').doc(appId)
      .collection('clientAccess').doc(clientEmail)
      .collection('notifications').doc()
    : null;
  const shouldLockSlot = status !== 'waitlist' && dateKey && time !== 'Waitlist';
  const slotLockRef = shouldLockSlot ? workspaceRef.collection('slotLocks').doc(safeLockId(dateKey, time)) : null;
  const idempotencyRef = idempotencyKey
    ? db
      .collection('artifacts').doc(appId)
      .collection('users').doc(ownerId)
      .collection('idempotencyKeys').doc(safeDocumentId(idempotencyKey))
    : null;

  const bookingRecord = {
    ownerId,
    clientName,
    clientPhone,
    clientEmail,
    clientEmailOptIn,
    clientBirthday,
    clientNote,
    serviceId,
    serviceName,
    serviceDescription,
    servicePrice,
    servicePriceType,
    serviceDuration,
    serviceCategory,
    notificationChannels,
    date,
    dateKey: dateKey || null,
    time,
    status,
    source: 'public-booking-page',
    paymentMethod,
    paymentGateway,
    paymentProviderName,
    paymentStatus,
    paymentReference: isManualPayment ? bookingRef.id : '',
    workspaceSlug,
    workspaceName: workspace.workspaceName || workspace.brandName || '',
    workspaceLogo: workspace.logo || workspace.businessLogo || '',
    threadId,
    timestamp: Date.now(),
    createdAt: serverTimestamp()
  };

  let transactionResult = null;
  await db.runTransaction(async (transaction) => {
    if (idempotencyRef) {
      const idempotencySnap = await transaction.get(idempotencyRef);
      if (idempotencySnap.exists) {
        const stored = idempotencySnap.data() || {};
        transactionResult = stored.result || { ok: true, bookingId: stored.bookingId, reused: true };
        return;
      }
    }

    if (slotLockRef) {
      const lockSnap = await transaction.get(slotLockRef);
      if (lockSnap.exists) {
        throw new HttpsError('already-exists', 'That time was just requested. Pick another slot.');
      }
      transaction.set(slotLockRef, {
        bookingId: bookingRef.id,
        ownerId,
        dateKey,
        time,
        status,
        createdAt: serverTimestamp()
      });
    }

    transaction.set(bookingRef, bookingRecord);
    transaction.set(publicSubmissionRef, bookingRecord);
    if (clientAccessRef) {
      transaction.set(clientAccessRef, {
        bookingId: bookingRef.id,
        threadId,
        ownerId,
        clientEmail,
        clientName,
        workspaceSlug,
        workspaceName: bookingRecord.workspaceName,
        workspaceLogo: bookingRecord.workspaceLogo,
        date,
        dateKey: dateKey || null,
        time,
        serviceId,
        serviceName,
        serviceDescription,
        servicePrice,
        servicePriceType,
        serviceDuration,
        serviceCategory,
        paymentMethod,
        paymentGateway,
        paymentProviderName,
        paymentStatus,
        paymentReference: isManualPayment ? bookingRef.id : '',
        status,
        timestamp: bookingRecord.timestamp,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
    transaction.set(threadRef, {
      ownerId,
      clientEmail,
      clientName,
      bookingId: bookingRef.id,
      workspaceSlug,
      workspaceName: bookingRecord.workspaceName,
      workspaceLogo: bookingRecord.workspaceLogo,
      serviceId,
      serviceName,
      paymentMethod,
      paymentGateway,
      paymentProviderName,
      paymentStatus,
      paymentReference: isManualPayment ? bookingRef.id : '',
      bookingStatus: status,
      status: 'open',
      lastMessage: `Booking request received${serviceName ? ` for ${serviceName}` : ''} on ${date} at ${time}.`,
      lastMessageAt: serverTimestamp(),
      ownerUnread: 1,
      clientUnread: 0,
      rescheduleStatus: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
    transaction.set(ownerNotificationRef, {
      audience: 'owner',
      type: 'booking_request',
      title: `New booking request from ${clientName}`,
      body: `${serviceName ? `${serviceName} / ` : ''}${date} at ${time}. Review, confirm, waitlist, or reply from My Bookings.`,
      ownerId,
      bookingId: bookingRef.id,
      threadId,
      clientName,
      clientEmail,
      workspaceSlug,
      tab: 'bookings',
      priority: 'high',
      read: false,
      createdAtMs: bookingRecord.timestamp,
      createdAt: serverTimestamp()
    });
    if (clientNotificationRef) {
      transaction.set(clientNotificationRef, {
        audience: 'client',
        type: 'booking_received',
        title: 'Your booking request was sent',
        body: `${bookingRecord.workspaceName || 'The business'} received your request${serviceName ? ` for ${serviceName}` : ''} on ${date} at ${time}. Track it in your client portal.`,
        ownerId,
        bookingId: bookingRef.id,
        threadId,
        clientName,
        clientEmail,
        workspaceSlug,
        workspaceName: bookingRecord.workspaceName,
        view: 'bookings',
        priority: 'normal',
        read: false,
        createdAtMs: bookingRecord.timestamp,
        createdAt: serverTimestamp()
      });
    }
    transaction.set(initialMessageRef, {
      text: `Booking request received${serviceName ? ` for ${serviceName}` : ''} on ${date} at ${time}. The business can confirm, reply, or help you reschedule here.`,
      kind: 'booking-created',
      bookingId: bookingRef.id,
      senderId: 'system',
      senderName: 'Build A Booking',
      senderRole: 'system',
      createdAt: serverTimestamp()
    });
    transaction.set(notificationRef, {
      appId,
      ownerId,
      bookingId: bookingRef.id,
      workspaceSlug,
      threadId,
      type: 'new-booking-request',
      status: 'queued',
      channels: notificationChannels,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    transactionResult = { ok: true, bookingId: bookingRef.id, paymentReference: bookingRecord.paymentReference || '', reused: false };
    if (idempotencyRef) {
      transaction.set(idempotencyRef, {
        key: idempotencyKey,
        bookingId: bookingRef.id,
        ownerId,
        workspaceSlug,
        result: transactionResult,
        createdAtMs: bookingRecord.timestamp,
        createdAt: serverTimestamp()
      });
    }
  });

  return transactionResult || { ok: true, bookingId: bookingRef.id };
});

exports.processNotificationJob = onDocumentCreated({
  region: 'us-central1',
  document: 'artifacts/{appId}/notificationJobs/{jobId}'
}, async (event) => {
  const snap = event.data;
  if (!snap) return;

  const job = snap.data() || {};
  const hasEmailProvider = Boolean(process.env.RESEND_API_KEY);

  await snap.ref.set({
    status: hasEmailProvider ? 'ready-for-provider' : 'waiting-for-provider-setup',
    providerState: {
      email: hasEmailProvider ? 'configured' : 'missing',
      clientPortal: 'active'
    },
    lastNote: job.type === 'new-booking-request'
      ? 'Booking notification queued. Connect provider secrets to enable sending.'
      : 'Notification queued.',
    updatedAt: serverTimestamp()
  }, { merge: true });
});

exports.createCheckoutSession = onCall({ region: 'us-central1' }, async () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new HttpsError('failed-precondition', 'Stripe is not configured yet.');
  }
  throw new HttpsError('unimplemented', 'Checkout wiring is ready for your Stripe price IDs.');
});

exports.createBillingPortalSession = onCall({ region: 'us-central1' }, async () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new HttpsError('failed-precondition', 'Stripe is not configured yet.');
  }
  throw new HttpsError('unimplemented', 'Billing portal wiring is ready for your Stripe customer IDs.');
});

const paymentFunctions = require('./payments');
Object.assign(exports, paymentFunctions);

const aiFunctions = require('./ai/openrouter');
Object.assign(exports, aiFunctions);
