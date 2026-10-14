import { createSingleFlight } from './single-flight';

/** Một việc async mà test tự quyết lúc nào xong. */
function deferredTask() {
  let resolve: (value: string) => void = () => {};
  let reject: (error: Error) => void = () => {};
  const task = jest.fn(
    () =>
      new Promise<string>((res, rej) => {
        resolve = res;
        reject = rej;
      }),
  );
  return { task, resolve: (v: string) => resolve(v), reject: (e: Error) => reject(e) };
}

describe('createSingleFlight', () => {
  it('lượt thứ hai tới khi lượt đầu chưa xong thì bị bỏ qua, không chạy song song', async () => {
    const once = createSingleFlight();
    const { task, resolve } = deferredTask();

    const first = once(task);
    const second = once(task);
    expect(task).toHaveBeenCalledTimes(1);
    await expect(second).resolves.toBeUndefined();

    resolve('done');
    await expect(first).resolves.toBe('done');
  });

  it('lượt đầu xong thì lượt sau chạy bình thường', async () => {
    const once = createSingleFlight();
    const { task, resolve } = deferredTask();

    const first = once(task);
    resolve('a');
    await first;
    void once(task);
    expect(task).toHaveBeenCalledTimes(2);
  });

  it('lượt đầu ném lỗi thì lỗi về đúng người gọi và khoá được nhả', async () => {
    const once = createSingleFlight();
    const { task, reject } = deferredTask();

    const first = once(task);
    reject(new Error('picker failed'));
    await expect(first).rejects.toThrow('picker failed');
    void once(task);
    expect(task).toHaveBeenCalledTimes(2);
  });
});
