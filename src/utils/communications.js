import { createDefaultEmailConfig } from '../services/email';

export const emailMessageKeys = ['confirmed', 'review', 'waitlist', 'runningLate'];

export const createDefaultCommunications = () => ({
  confirmed: { active: true, text: "Your booking request is confirmed! We look forward to seeing you." },
  review: { active: true, text: "Hey! Thanks for coming in today. We'd love it if you could leave a quick review." },
  waitlist: { active: true, text: "A spot just opened up for you! Tap here to claim it." },
  runningLate: { active: true, text: "Running 10-15 mins behind. See you soon!" },
  emailProvider: createDefaultEmailConfig()
});

export const normalizeCommunications = (communications = {}) => {
  const defaults = createDefaultCommunications();
  return {
    ...defaults,
    ...communications,
    confirmed: { ...defaults.confirmed, ...(communications.confirmed || {}) },
    review: { ...defaults.review, ...(communications.review || {}) },
    waitlist: { ...defaults.waitlist, ...(communications.waitlist || {}) },
    runningLate: { ...defaults.runningLate, ...(communications.runningLate || {}) },
    emailProvider: {
      ...defaults.emailProvider,
      ...(communications.emailProvider || {}),
      templates: {
        ...(defaults.emailProvider?.templates || {}),
        ...(communications.emailProvider?.templates || {})
      }
    }
  };
};
