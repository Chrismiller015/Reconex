import "@testing-library/jest-dom";
import { TextDecoder, TextEncoder } from "node:util";
import { ReadableStream, WritableStream, TransformStream } from "node:stream/web";
import { MessagePort } from "node:worker_threads";
import { Blob, File } from "node:buffer";

// Keep tests runnable without full production env configuration.
process.env.SKIP_ENV_VALIDATION ??= "true";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5433/reconex?schema=public";

// Some environments (jest + jsdom) don't provide these Node globals.
globalThis.TextEncoder = globalThis.TextEncoder ?? (TextEncoder as unknown as typeof globalThis.TextEncoder);
globalThis.TextDecoder = globalThis.TextDecoder ?? (TextDecoder as unknown as typeof globalThis.TextDecoder);
globalThis.ReadableStream = globalThis.ReadableStream ?? (ReadableStream as unknown as typeof globalThis.ReadableStream);
globalThis.WritableStream = globalThis.WritableStream ?? (WritableStream as unknown as typeof globalThis.WritableStream);
globalThis.TransformStream =
  globalThis.TransformStream ?? (TransformStream as unknown as typeof globalThis.TransformStream);
globalThis.MessagePort = globalThis.MessagePort ?? (MessagePort as unknown as typeof globalThis.MessagePort);

// Next.js route handlers rely on the WHATWG fetch globals.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Headers, Request, Response, fetch, FormData } = require("undici") as typeof import("undici");
globalThis.fetch = globalThis.fetch ?? (fetch as unknown as typeof globalThis.fetch);
globalThis.Headers = globalThis.Headers ?? (Headers as unknown as typeof globalThis.Headers);
globalThis.Request = globalThis.Request ?? (Request as unknown as typeof globalThis.Request);
globalThis.Response = globalThis.Response ?? (Response as unknown as typeof globalThis.Response);
// Align File/Blob/FormData across environments so `instanceof File` works in route handlers.
globalThis.Blob = Blob as unknown as typeof globalThis.Blob;
globalThis.File = File as unknown as typeof globalThis.File;
globalThis.FormData = FormData as unknown as typeof globalThis.FormData;
