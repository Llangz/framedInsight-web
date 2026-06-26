'use server'

import { validateCoopAccess } from '@/lib/validate-coop-access'
import { createPassport, publishPassport } from '@/lib/passport/passport.service'
import { revalidatePath } from 'next/cache'

export async function createPassportAction(params: {
  cooperativeId: string
  processingBatchId: string
  exportLotId?: string
  actorUserId: string
}): Promise<{ success: boolean; passportCode?: string; error?: string }> {
  const access = await validateCoopAccess()
  if (!access.success || access.coopId !== params.cooperativeId) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    const result = await createPassport({
      cooperativeId: params.cooperativeId,
      processingBatchId: params.processingBatchId,
      exportLotId: params.exportLotId,
      actorUserId: params.actorUserId,
    })
    revalidatePath('/dashboard/cooperative/passports')
    return { success: true, passportCode: result.passportCode }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function publishPassportAction(
  passportId: string,
  cooperativeId: string,
  actorUserId: string
): Promise<{ success: boolean; error?: string }> {
  const access = await validateCoopAccess()
  if (!access.success || access.coopId !== cooperativeId) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    await publishPassport(passportId, cooperativeId, actorUserId)
    revalidatePath('/dashboard/cooperative/passports')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}