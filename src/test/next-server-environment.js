/* eslint-disable @typescript-eslint/no-var-requires */
const NodeEnvironment = require('jest-environment-node');

// Jest 27 的 node 环境写在 fetch 全局成为标准之前，不会把 Request 拷进测试沙箱。
// Next 的路由模块在加载时就会继承全局 Request，缺了它测试还没跑到断言就挂了。
const webGlobals = {
  Request: globalThis.Request,
  Response: globalThis.Response,
  Headers: globalThis.Headers,
  fetch: globalThis.fetch,
  FormData: globalThis.FormData,
  Blob: globalThis.Blob,
  File: globalThis.File,
  ReadableStream: globalThis.ReadableStream,
  WritableStream: globalThis.WritableStream,
  TransformStream: globalThis.TransformStream,
};

class NextServerEnvironment extends NodeEnvironment {
  constructor(config, context) {
    super(config, context);
    for (const [name, value] of Object.entries(webGlobals)) {
      if (typeof value !== 'undefined') {
        this.global[name] = value;
      }
    }
  }
}

module.exports = NextServerEnvironment;
