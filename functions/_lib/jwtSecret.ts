// 共用給 functions/api/**：讀取簽發/驗證 JWT 用的 secret。
// repo 是 public，絕對不能有硬編碼 fallback——缺 JWT_SECRET 時必須 fail closed。
export const JWT_SECRET_ERROR_MESSAGE = '伺服器未設定 JWT_SECRET，請聯絡系統管理員'

export function getJwtSecret(env: any): string | null {
  const secret = env?.JWT_SECRET
  return typeof secret === 'string' && secret.length > 0 ? secret : null
}
