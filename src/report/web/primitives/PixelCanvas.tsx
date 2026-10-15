import { useEffect, useRef } from 'react';
import type { DrawFrame, PixelScene } from '../pixel/frame.ts';

type Props = {
  /** Must be referentially stable; a new scene rebuilds the canvas. */
  scene: PixelScene;
};

const largeQuery = '(min-width: 64rem)';
const reducedMotionQuery = '(prefers-reduced-motion: reduce)';
const frameInterval = 1000 / 30;

/**
 * Fills its positioned parent with a pixel-art canvas: 4px art pixels from lg, 3px below. Animates at 30fps while
 * on screen, and draws a single still frame under reduced motion.
 */
export function PixelCanvas({ scene }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;
    const context = canvas?.getContext('2d');
    if (!canvas || !container || !context) return;

    const large = window.matchMedia(largeQuery);
    const reducedMotion = window.matchMedia(reducedMotionQuery);
    let draw: DrawFrame | undefined;
    let image: ImageData | undefined;
    let running = false;
    let visible = false;
    let animationFrame = 0;
    let lastPaint = 0;

    const paint = (time: number) => {
      if (!draw || !image) return;
      draw(time);
      context.putImageData(image, 0, 0);
    };
    const layout = () => {
      const pixel = large.matches ? 4 : 3;
      const bounds = container.getBoundingClientRect();
      const width = Math.max(1, Math.ceil(bounds.width / pixel));
      const height = Math.max(1, Math.ceil(bounds.height / pixel));
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = `${width * pixel}px`;
      canvas.style.height = `${height * pixel}px`;
      image = context.createImageData(width, height);
      draw = scene({ width, height, pixel, pixels: new Uint32Array(image.data.buffer), container });
      paint(performance.now());
      canvas.hidden = false;
    };
    const tick = (time: number) => {
      if (!running) return;
      animationFrame = requestAnimationFrame(tick);
      if (time - lastPaint < frameInterval) return;
      lastPaint = time;
      paint(time);
    };
    const sync = () => {
      const shouldRun = visible && !reducedMotion.matches && !document.hidden;
      if (shouldRun === running) return;
      running = shouldRun;
      if (running) animationFrame = requestAnimationFrame(tick);
      else cancelAnimationFrame(animationFrame);
    };

    const resizeObserver = new ResizeObserver(layout);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      sync();
    });
    resizeObserver.observe(container);
    intersectionObserver.observe(container);
    large.addEventListener('change', layout);
    reducedMotion.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    return () => {
      running = false;
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      large.removeEventListener('change', layout);
      reducedMotion.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [scene]);

  // Hidden until its first frame: shown at its default 300x150 and then sized to its parent, it would count as a
  // layout shift. The parent's CSS backdrop stands in until then.
  return <canvas ref={canvasRef} hidden aria-hidden="true" className="pixelated absolute bottom-0 left-0 -z-10" />;
}
