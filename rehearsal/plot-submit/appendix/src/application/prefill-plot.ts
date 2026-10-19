import { z } from 'zod'
import { domainError, type DomainError } from '../domain/errors'
import { err, ok, type Result } from '../domain/result'

export const PrefillPlotInput = z
  .object({
    transcript: z.string().min(1).max(500),
  })
  .strict()

export interface PlotPrefill {
  readonly groupName?: string
  readonly areaMu?: number
  readonly crop?: string
  readonly confidence: number
  readonly needsConfirmation: true
}

const CROP_KEYWORDS = ['茶', '蜂蜜', '稻', '玉米', '果蔬', '蔬菜', '香菇', '木耳', '油茶'] as const

/**
 * AI 预填工具（纯函数，不写库）：
 * 从语音转写中抽取地块字段，只返回建议；必须由农户确认后才能进入提交用例。
 */
export function prefillPlotFromTranscript(
  raw: unknown
): Result<PlotPrefill, DomainError> {
  const parsed = PrefillPlotInput.safeParse(raw)
  if (!parsed.success) {
    return err(domainError('PLOT_INVALID_INPUT', '转写文本不合法'))
  }

  const text = parsed.data.transcript
  const areaMatch = text.match(/(\d+(?:\.\d+)?)\s*(亩|平方米|平米)/)
  const crop = CROP_KEYWORDS.find((keyword) => text.includes(keyword))
  const groupMatch = text.match(/([一二三四五六七八九十\d]+组)/)

  const areaMu = areaMatch ? Number(areaMatch[1]) : undefined
  const groupName = groupMatch?.[1]
  const hitCount = [areaMu, crop, groupName].filter(
    (value) => value !== undefined
  ).length

  return ok({
    ...(groupName ? { groupName } : {}),
    ...(areaMu ? { areaMu } : {}),
    ...(crop ? { crop } : {}),
    confidence: hitCount / 3,
    needsConfirmation: true,
  })
}
