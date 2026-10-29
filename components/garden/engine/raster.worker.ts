import { Rasterizer, type RasterJob } from './rasterize'

// Rasterises frames off the main thread, so the page keeps drawing while plant shapes are filled.
const rasterizer = new Rasterizer(() => {
  const ctx = new OffscreenCanvas(1, 1).getContext('2d', {
    willReadFrequently: true,
  })
  if (!ctx) throw new Error('OffscreenCanvas 2D unavailable')
  return ctx
})

self.onmessage = (e: MessageEvent<RasterJob & { seq: number }>) => {
  const out = { ...rasterizer.run(e.data), seq: e.data.seq }
  const transfer = [out.color.buffer, out.kind.buffer]
  if (out.meta) transfer.push(out.meta.buffer)
  self.postMessage(out, { transfer: transfer as Transferable[] })
}
