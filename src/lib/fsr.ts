import { canProcessAnime4KVideoFrame } from '@/lib/anime4k-policy';
import { computeFsrEasuConstants, computeFsrRcasLinear } from '@/lib/fsr-math';
import { fullscreenTexturedQuadWGSL, fsrEasuWGSL, fsrRcasWGSL } from '@/lib/fsr-shaders';

export interface FSRRendererOptions {
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  scale: number;
  /** AMD RCAS sharpness. 0 = strongest, larger = milder. */
  sharpness?: number;
  onFirstFrame?: () => void;
}

export interface FSRController {
  stop: () => void;
}

const DEFAULT_SHARPNESS = 0.28;

async function canCopyExternalImageToTexture(): Promise<boolean> {
  try {
    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter?.requestDevice();
    if (!device) return false;

    const offscreen = new OffscreenCanvas(1, 1);
    const ctx = offscreen.getContext('2d') as unknown as CanvasRenderingContext2D | null;
    if (!ctx) return false;
    ctx.fillRect(0, 0, 1, 1);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const VideoFrameCtor = (window as any).VideoFrame as unknown;
    if (typeof VideoFrameCtor !== 'function') return false;
    const frame = new (VideoFrameCtor as {
      new (source: CanvasImageSource, opts: { timestamp: number }): ImageBitmap;
    })(offscreen, { timestamp: 0 });

    const texture = device.createTexture({
      size: [1, 1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    device.queue.copyExternalImageToTexture({ source: frame }, { texture }, [1, 1]);
    frame.close();
    texture.destroy();
    device.destroy();
    return true;
  } catch {
    return false;
  }
}

async function createShaderModuleOrThrow(device: GPUDevice, code: string, label: string): Promise<GPUShaderModule> {
  device.pushErrorScope('validation');
  const module = device.createShaderModule({ code, label });
  const error = await device.popErrorScope();
  if (error) {
    throw new Error(`${label} 着色器无效: ${error.message}`);
  }
  return module;
}

async function createQuadPipeline(
  device: GPUDevice,
  fragment: string,
  entryPoint: string,
  format: GPUTextureFormat,
  bindGroupLayout: GPUBindGroupLayout
): Promise<GPURenderPipeline> {
  const vertexModule = await createShaderModuleOrThrow(device, fullscreenTexturedQuadWGSL, 'fsr-vertex');
  const fragmentModule = await createShaderModuleOrThrow(device, fragment, `fsr-${entryPoint}`);
  return device.createRenderPipelineAsync({
    layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
    vertex: {
      module: vertexModule,
      entryPoint: 'vert_main',
    },
    fragment: {
      module: fragmentModule,
      entryPoint,
      targets: [{ format }],
    },
    primitive: { topology: 'triangle-list' },
  });
}

export async function createFSRRenderer(options: FSRRendererOptions): Promise<FSRController> {
  const { video, canvas, scale, onFirstFrame } = options;
  const sharpness = options.sharpness ?? DEFAULT_SHARPNESS;

  const srcW = video.videoWidth;
  const srcH = video.videoHeight;
  if (!srcW || !srcH) {
    throw new Error('无法获取视频尺寸');
  }
  const outW = Math.max(1, Math.floor(srcW * scale));
  const outH = Math.max(1, Math.floor(srcH * scale));
  if (!Number.isFinite(outW) || !Number.isFinite(outH)) {
    throw new Error(`输出Canvas尺寸无效: ${outW}x${outH}, scale: ${scale}`);
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error('WebGPU 不支持：无法获取 GPU 适配器');
  }
  const device = await adapter.requestDevice({
    requiredLimits: {
      maxBufferSize: Math.min(adapter.limits.maxBufferSize || 2147483648, 2147483648),
      maxStorageBufferBindingSize: Math.min(
        adapter.limits.maxStorageBufferBindingSize || 1073741824,
        1073741824
      ),
    },
  });

  const context = canvas.getContext('webgpu');
  if (!context) {
    throw new Error('无法获取 WebGPU canvas 上下文');
  }
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format: presentationFormat,
    alphaMode: 'premultiplied',
  });

  const inputTexture = device.createTexture({
    size: [srcW, srcH, 1],
    format: 'rgba16float',
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const upscale = scale > 1 + 1e-6;
  const easuTexture = upscale
    ? device.createTexture({
        size: [outW, outH, 1],
        format: 'rgba16float',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
      })
    : null;

  const sampler = device.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
    addressModeU: 'clamp-to-edge',
    addressModeV: 'clamp-to-edge',
  });

  const easuLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' as GPUBufferBindingType },
      },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
    ],
  });
  const rcasLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' as GPUBufferBindingType },
      },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
    ],
  });

  const easuPipeline = upscale
    ? await createQuadPipeline(device, fsrEasuWGSL, 'fs_easu', 'rgba16float', easuLayout)
    : null;
  const rcasPipeline = await createQuadPipeline(
    device,
    fsrRcasWGSL,
    'fs_rcas',
    presentationFormat,
    rcasLayout
  );

  const easuUniform = device.createBuffer({
    size: 64,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(easuUniform, 0, computeFsrEasuConstants(srcW, srcH, outW, outH));

  const rcasUniform = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(
    rcasUniform,
    0,
    new Float32Array([computeFsrRcasLinear(sharpness), 0, 0, 0])
  );

  const easuBindGroup = easuPipeline
    ? device.createBindGroup({
        layout: easuLayout,
        entries: [
          { binding: 0, resource: { buffer: easuUniform } },
          { binding: 1, resource: inputTexture.createView() },
          { binding: 2, resource: sampler },
        ],
      })
    : null;

  const rcasSource = easuTexture ?? inputTexture;
  const rcasBindGroup = device.createBindGroup({
    layout: rcasLayout,
    entries: [
      { binding: 0, resource: { buffer: rcasUniform } },
      { binding: 1, resource: rcasSource.createView() },
    ],
  });

  const useImageBitmap = !(await canCopyExternalImageToTexture());
  let destroyed = false;
  let rafId = 0;
  let firstFrameNotified = false;

  const copyCurrentFrame = async (): Promise<boolean> => {
    if (destroyed || !canProcessAnime4KVideoFrame(video)) {
      return false;
    }

    if (useImageBitmap) {
      const bitmap = await createImageBitmap(video);
      try {
        device.queue.copyExternalImageToTexture(
          { source: bitmap },
          { texture: inputTexture },
          [srcW, srcH]
        );
      } finally {
        bitmap.close();
      }
    } else {
      device.queue.copyExternalImageToTexture(
        { source: video },
        { texture: inputTexture },
        [srcW, srcH]
      );
    }

    const encoder = device.createCommandEncoder();
    if (easuPipeline && easuTexture && easuBindGroup) {
      const easuPass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: easuTexture.createView(),
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            loadOp: 'clear',
            storeOp: 'store',
          } as GPURenderPassColorAttachment,
        ],
      });
      easuPass.setPipeline(easuPipeline);
      easuPass.setBindGroup(0, easuBindGroup);
      easuPass.draw(6);
      easuPass.end();
    }

    const rcasPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        } as GPURenderPassColorAttachment,
      ],
    });
    rcasPass.setPipeline(rcasPipeline);
    rcasPass.setBindGroup(0, rcasBindGroup);
    rcasPass.draw(6);
    rcasPass.end();
    device.queue.submit([encoder.finish()]);

    if (!firstFrameNotified) {
      firstFrameNotified = true;
      onFirstFrame?.();
    }
    return true;
  };

  const loop = async (): Promise<void> => {
    if (destroyed) return;
    try {
      await copyCurrentFrame();
    } catch (err) {
      if (!destroyed) {
        // eslint-disable-next-line no-console
        console.error('[FSR] 帧处理失败:', err);
      }
    }
    rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);

  const stop = (): void => {
    if (destroyed) return;
    destroyed = true;
    cancelAnimationFrame(rafId);
    try {
      inputTexture.destroy();
    } catch {
      /* 忽略 */
    }
    try {
      easuTexture?.destroy();
    } catch {
      /* 忽略 */
    }
    try {
      easuUniform.destroy();
      rcasUniform.destroy();
    } catch {
      /* 忽略 */
    }
    try {
      context.unconfigure();
    } catch {
      /* 忽略 */
    }
    try {
      device.destroy();
    } catch {
      /* 忽略 */
    }
  };

  return { stop };
}
