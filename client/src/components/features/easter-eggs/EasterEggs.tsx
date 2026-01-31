import { useState, useEffect, useCallback, useRef } from 'react';

// Matrix Rain Effect Component
function MatrixRain({ onComplete }: { onComplete: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Test-related keywords for the matrix effect
    const keywords = [
      'assert', 'expect', 'verify', 'test', 'pass', 'fail', 'skip',
      'describe', 'it', 'should', 'when', 'given', 'then', 'and',
      'mock', 'spy', 'stub', 'fixture', 'setup', 'teardown',
      'beforeEach', 'afterEach', 'beforeAll', 'afterAll',
      'toBe', 'toEqual', 'toHave', 'toContain', 'toThrow',
      'async', 'await', 'promise', 'resolve', 'reject',
      'render', 'click', 'type', 'submit', 'validate',
      'TEST', 'PASS', 'FAIL', 'XRAY', 'JIRA', 'BUG', 'FIX',
      '✓', '✗', '→', '⚡', '🐛', '🧪', '✅', '❌'
    ];

    const fontSize = 14;
    const columns = Math.floor(canvas.width / fontSize);
    const drops: number[] = Array(columns).fill(1);
    const chars: string[] = Array(columns).fill('');

    // Assign random keywords to each column
    for (let i = 0; i < columns; i++) {
      chars[i] = keywords[Math.floor(Math.random() * keywords.length)];
    }

    let frameCount = 0;
    const maxFrames = 400; // ~6-7 seconds at 60fps

    const draw = () => {
      // Semi-transparent black to create fade effect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#0f0';
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const text = chars[i];
        const x = i * fontSize;
        const y = drops[i] * fontSize;

        // Brighter green for the leading character
        if (Math.random() > 0.5) {
          ctx.fillStyle = '#0f0';
        } else {
          ctx.fillStyle = '#0a0';
        }

        // Draw character by character from the keyword
        const charIndex = Math.floor(drops[i]) % text.length;
        ctx.fillText(text[charIndex] || text[0], x, y);

        // Reset drop randomly or when it goes off screen
        if (y > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
          chars[i] = keywords[Math.floor(Math.random() * keywords.length)];
        }

        drops[i] += 0.5 + Math.random() * 0.5;
      }

      frameCount++;
      if (frameCount < maxFrames) {
        requestAnimationFrame(draw);
      } else {
        // Fade out
        const fadeOut = () => {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const hasColor = imageData.data.some((v, i) => i % 4 === 1 && v > 10); // Check green channel
          if (hasColor) {
            requestAnimationFrame(fadeOut);
          } else {
            onComplete();
          }
        };
        fadeOut();
      }
    };

    draw();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [onComplete]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[9999] pointer-events-none"
      style={{ background: 'transparent' }}
    />
  );
}

// Xray Vision Overlay
function XrayVision({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    // Add xray class to body
    document.body.classList.add('xray-vision');

    // Auto-disable after 8 seconds
    const timer = setTimeout(() => {
      onComplete();
    }, 8000);

    // Or disable on any click
    const handleClick = () => onComplete();
    document.addEventListener('click', handleClick);

    return () => {
      document.body.classList.remove('xray-vision');
      clearTimeout(timer);
      document.removeEventListener('click', handleClick);
    };
  }, [onComplete]);

  return (
    <>
      <style>{`
        .xray-vision * {
          background: transparent !important;
          border: 1px solid rgba(0, 255, 255, 0.3) !important;
          box-shadow: 0 0 2px rgba(0, 255, 255, 0.5) !important;
          transition: all 0.3s ease !important;
        }
        .xray-vision *:hover {
          border-color: rgba(0, 255, 255, 0.8) !important;
          box-shadow: 0 0 10px rgba(0, 255, 255, 0.8) !important;
        }
        .xray-vision {
          background: #000 !important;
        }
        .xray-vision img, .xray-vision svg {
          opacity: 0.3 !important;
          filter: brightness(2) saturate(0) !important;
        }
        .xray-vision input, .xray-vision textarea, .xray-vision button {
          color: cyan !important;
        }
        .xray-vision p, .xray-vision span, .xray-vision h1, .xray-vision h2,
        .xray-vision h3, .xray-vision h4, .xray-vision label, .xray-vision div {
          color: rgba(0, 255, 255, 0.9) !important;
        }
      `}</style>
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2 bg-black/80 border border-cyan-500 rounded-lg text-cyan-400 text-sm font-mono animate-pulse">
        XRAY VISION ACTIVE - Click anywhere to disable
      </div>
    </>
  );
}

// Main Easter Eggs Hook & Component
export function EasterEggs() {
  const [activeEgg, setActiveEgg] = useState<'matrix' | 'xray' | null>(null);
  const keyBuffer = useRef<string>('');
  const shiftHeld = useRef(false);
  const lastKeyTime = useRef(0);

  const handleComplete = useCallback(() => {
    setActiveEgg(null);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Track shift key
      if (e.key === 'Shift') {
        shiftHeld.current = true;
      }

      // Clear buffer if too much time passed
      const now = Date.now();
      if (now - lastKeyTime.current > 1000) {
        keyBuffer.current = '';
      }
      lastKeyTime.current = now;

      // Add key to buffer
      const key = e.key.toLowerCase();
      if (key.length === 1) {
        keyBuffer.current += key;

        // Keep buffer manageable
        if (keyBuffer.current.length > 20) {
          keyBuffer.current = keyBuffer.current.slice(-20);
        }

        // Check for "matrix" trigger (can be typed anywhere)
        if (keyBuffer.current.endsWith('matrix')) {
          keyBuffer.current = '';
          if (!activeEgg) {
            setActiveEgg('matrix');
          }
        }

        // Check for "xray" trigger (requires shift held)
        if (shiftHeld.current && keyBuffer.current.endsWith('xray')) {
          keyBuffer.current = '';
          if (!activeEgg) {
            setActiveEgg('xray');
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        shiftHeld.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [activeEgg]);

  if (!activeEgg) return null;

  return (
    <>
      {activeEgg === 'matrix' && <MatrixRain onComplete={handleComplete} />}
      {activeEgg === 'xray' && <XrayVision onComplete={handleComplete} />}
    </>
  );
}
