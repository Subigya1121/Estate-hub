const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+\d][\d\s-]{6,}$/;

const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
export const todayLocal = today;

function base(v, { phoneRequired = false } = {}) {
  const e = {};
  if (v.name.trim().length < 2) e.name = "Please enter your name.";
  if (!EMAIL_RE.test(v.email.trim())) e.email = "Please enter a valid email address.";
  const phone = v.phone.trim();
  if (phoneRequired && !phone) e.phone = "Please enter a phone number.";
  else if (phone && !PHONE_RE.test(phone)) e.phone = "Please enter a valid phone number.";
  return e;
}

export function validateInquiry(v) {
  const e = base(v);
  const len = v.message.trim().length;
  if (len < 10) e.message = "Please write at least 10 characters.";
  else if (len > 2000) e.message = "Please keep your message under 2000 characters.";
  return e;
}

export function validateContact(v) {
  const e = base(v);
  const len = v.message.trim().length;
  if (len < 10) e.message = "Please write at least 10 characters.";
  else if (len > 4000) e.message = "Please keep your message under 4000 characters.";
  return e;
}

export function validateVisit(v) {
  const e = base(v, { phoneRequired: true });
  if (!v.date) e.date = "Please choose a date.";
  else if (v.date < today()) e.date = "Please choose a date from today onwards.";
  if (!["morning", "afternoon", "evening"].includes(v.time)) e.time = "Please choose a time of day.";
  if (v.message.length > 1000) e.message = "Please keep your note under 1000 characters.";
  return e;
}
