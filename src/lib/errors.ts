const MESSAGES: Record<string, string> = {
  ROOM_NOT_FOUND: 'الكود مش صحيح',
  ROOM_FULL: 'الروم دي اتملت',
  NOT_FOUNDER: 'اللي بيبدأ الزنقة هو صاحب الروم بس',
  ALREADY_STARTED: 'الزنقة بدأت بالفعل',
  NEED_TWO_MEMBERS: 'لازم يكونوا اتنين على الأقل عشان نبدأ',
  NOT_STARTED: 'الزنقة لسه ما بدأتش',
  INVALID_NAME: 'الاسم لازم يكون من 2 لـ 24 حرف',
  NO_PROFILE: 'اكتب اسمك الأول',
  NOT_AUTHENTICATED: 'الجلسة خلصت، ادخل اسمك تاني',
};

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
  if (isNetworkError(e)) return 'حصلت مشكلة في الاتصال. بنحاول نرجع...';
  return 'حصلت مشكلة غير متوقعة: ' + (e instanceof Error ? e.message : String(e));
}
