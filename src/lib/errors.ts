const MESSAGES: Record<string, string> = {
  ROOM_NOT_FOUND: 'الكود مش صحيح',
  ROOM_FULL: 'الروم دي اتملت',
  NOT_FOUNDER: 'اللي بيبدأ الزنقة هو صاحب الروم بس',
  ALREADY_STARTED: 'الزنقة بدأت بالفعل',
  NEED_TWO_MEMBERS: 'لازم يكونوا اتنين على الأقل عشان نبدأ',
  NOT_STARTED: 'الزنقة لسه ما بدأتش',
  INVALID_NAME: 'الاسم لازم يكون من 2 لـ 24 حرف',
  NO_PROFILE: 'اكتب اسمك الأول',
  NOT_AUTHENTICATED: 'الجلسة خلصت، سجّل دخول تاني',
};

// Messages that come from Supabase Auth (English text), mapped to Arabic.
const AUTH_MESSAGES: [RegExp, string][] = [
  [/invalid login credentials/i, 'الإيميل أو الباسورد غلط'],
  [/email not confirmed/i, 'الإيميل لسه ما اتفعّلش. افتح إيميل التفعيل، أو اطلب إرساله تاني'],
  [/password should be at least|weak password|password is too/i, 'الباسورد ضعيف. لازم 8 حروف على الأقل'],
  [/email address not authorized/i, 'الموقع لسه مش مجهّز لإرسال الإيميلات لأي حد (إعداد SMTP ناقص)'],
  [/rate limit|too many|security purposes|only request this after/i, 'محاولات كتير. استنى شوية وجرّب تاني'],
  [/unable to validate email|invalid format|is invalid/i, 'الإيميل مش مظبوط'],
  [/error sending|sending .*email/i, 'ما قدرناش نبعت الإيميل. جرّب بعد شوية'],
  [/same password/i, 'اختار باسورد مختلف عن القديم'],
  [/user already registered/i, 'الإيميل ده مسجّل قبل كده. جرّب تسجيل الدخول'],
];

const NETWORK = /failed to fetch|network|load failed|timeout/i;

export function errorCode(e: unknown): string | null {
  const msg = e instanceof Error ? e.message : String(e);
  return Object.keys(MESSAGES).find((c) => msg.includes(c)) ?? null;
}

export function isNetworkError(e: unknown): boolean {
  return NETWORK.test(e instanceof Error ? e.message : String(e));
}

export function friendlyError(e: unknown): string {
  const code = errorCode(e);
  if (code) return MESSAGES[code];
  const raw = e instanceof Error ? e.message : String(e);
  const auth = AUTH_MESSAGES.find(([re]) => re.test(raw));
  if (auth) return auth[1];
  if (isNetworkError(e)) return 'حصلت مشكلة في الاتصال. بنحاول نرجع...';
  return 'حصلت مشكلة غير متوقعة: ' + (e instanceof Error ? e.message : String(e));
}
