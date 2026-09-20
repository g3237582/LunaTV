export const CONFIRM_ADULT_COMMAND = 'manga.confirmAdult';
export const CONFIRM_ADULT_LABEL = '点击此处继续阅读';
export const AGE_GATE_MESSAGE =
  '该漫画被源站列为限制内容。确认已满18岁后，可回传确认指令继续获取目录。';

export const CONFIRM_ADULT_ACTION = {
  type: 'confirmAdult',
  command: CONFIRM_ADULT_COMMAND,
  label: CONFIRM_ADULT_LABEL,
};

const AGE_GATE_PATTERN = /限制漫画|继续阅读|法定年龄|未成年|18\s*岁/;

export function isAgeGateError(message: string): boolean {
  return AGE_GATE_PATTERN.test(message || '');
}

export function mangaErrorPayload(error: unknown): {
  error: string;
  action?: typeof CONFIRM_ADULT_ACTION;
} {
  const message = error instanceof Error ? error.message : String(error || '');
  if (isAgeGateError(message)) {
    return {
      error: AGE_GATE_MESSAGE,
      action: CONFIRM_ADULT_ACTION,
    };
  }
  return { error: message || '获取漫画详情失败' };
}
