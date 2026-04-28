const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/** UTC Date/ISO → KST 오프셋이 적용된 Date 객체 (getUTC* 메서드로 KST 값 읽기) */
export function toKst(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Date(d.getTime() + KST_OFFSET_MS)
}

/** 현재 시각의 KST Date 객체 */
export function nowKst(): Date {
  return new Date(Date.now() + KST_OFFSET_MS)
}

const pad = (n: number) => String(n).padStart(2, '0')

/** KST 기준 "YYYY-MM-DD" */
export function toKstDateStr(date: Date | string): string {
  const k = toKst(date)
  return `${k.getUTCFullYear()}-${pad(k.getUTCMonth() + 1)}-${pad(k.getUTCDate())}`
}

/** KST 기준 "HH:mm" */
export function toKstTimeStr(date: Date | string): string {
  const k = toKst(date)
  return `${pad(k.getUTCHours())}:${pad(k.getUTCMinutes())}`
}

/** KST 기준 "M/D HH:mm" (로그 표시용) */
export function toKstShortStr(date: Date | string): string {
  const k = toKst(date)
  return `${k.getUTCMonth() + 1}/${k.getUTCDate()} ${pad(k.getUTCHours())}:${pad(k.getUTCMinutes())}`
}
