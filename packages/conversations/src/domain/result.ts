/** The outcome of an operation with expected rejections («Forma del tipo Result»). */
export type Result<T, E> = Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: E }>;
