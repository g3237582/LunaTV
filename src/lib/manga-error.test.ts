import { CONFIRM_ADULT_COMMAND, isAgeGateError, mangaErrorPayload } from './manga-error';

describe('mangaErrorPayload', () => {
  it('turns an age-gate dump into a confirm-adult command', () => {
    const payload = mangaErrorPayload(
      new Error('exception while fetching data (/fetchedChapters): 被列为限制漫画，点击此处继续阅读')
    );
    expect(payload.action?.command).toBe(CONFIRM_ADULT_COMMAND);
    expect(isAgeGateError(payload.error)).toBe(true);
  });

  it('keeps ordinary errors as plain messages', () => {
    const payload = mangaErrorPayload(new Error('源站暂时无法访问'));
    expect(payload.action).toBeUndefined();
    expect(payload.error).toBe('源站暂时无法访问');
  });
});
