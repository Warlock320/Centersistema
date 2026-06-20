'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { ScanLine, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface BarcodeScannerProps {
  onScan: (code: string) => void;
  placeholder?: string;
}

export default function BarcodeScanner({ onScan, placeholder }: BarcodeScannerProps) {
  const [buffer, setBuffer] = useState('');
  const [lastScan, setLastScan] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastKeyTime = useRef(0);

  // Leitor USB/Bluetooth — detecta digitação rápida (< 50ms entre teclas)
  useEffect(() => {
    let buf = '';
    let timer: ReturnType<typeof setTimeout>;

    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;

      const now = Date.now();
      if (now - lastKeyTime.current > 100) buf = '';
      lastKeyTime.current = now;

      if (e.key === 'Enter' && buf.length >= 4) {
        e.preventDefault();
        handleScan(buf);
        buf = '';
        return;
      }

      if (e.key.length === 1) buf += e.key;

      clearTimeout(timer);
      timer = setTimeout(() => { buf = ''; }, 200);
    }

    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); clearTimeout(timer); };
  }, []);

  const handleScan = useCallback((code: string) => {
    const cleaned = code.trim();
    if (cleaned.length < 4) return;
    setLastScan(cleaned);
    onScan(cleaned);
  }, [onScan]);

  // Input manual
  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (buffer.trim().length >= 1) {
      handleScan(buffer.trim());
      setBuffer('');
    }
  }

  // Camera scanner usando BarcodeDetector API (Chrome/Edge)
  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setShowCamera(true);
      scanLoop();
    } catch {
      setLastScan('Erro: não foi possível acessar a câmera.');
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setShowCamera(false);
  }

  async function scanLoop() {
    if (!('BarcodeDetector' in window)) {
      setLastScan('Navegador não suporta leitura por câmera. Use Chrome ou Edge.');
      stopCamera();
      return;
    }
    // @ts-expect-error BarcodeDetector not in all TS libs
    const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code'] });

    const scan = async () => {
      if (!videoRef.current || !streamRef.current) return;
      try {
        const barcodes = await detector.detect(videoRef.current);
        if (barcodes.length > 0) {
          handleScan(barcodes[0].rawValue);
          stopCamera();
          return;
        }
      } catch { /* ignore detection errors */ }
      if (streamRef.current) requestAnimationFrame(scan);
    };
    requestAnimationFrame(scan);
  }

  useEffect(() => () => { streamRef.current?.getTracks().forEach((t) => t.stop()); }, []);

  return (
    <div className="space-y-2">
      <form onSubmit={handleManualSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <ScanLine size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={buffer}
            onChange={(e) => setBuffer(e.target.value)}
            placeholder={placeholder || 'Ler código de barras (USB, câmera ou digitar)...'}
            className="w-full pl-10 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <Button type="submit" variant="secondary" size="sm" disabled={!buffer.trim()}>Buscar</Button>
        <Button type="button" variant="secondary" size="sm" onClick={showCamera ? stopCamera : startCamera}>
          {showCamera ? <X size={14} /> : <ScanLine size={14} />} {showCamera ? 'Fechar' : 'Câmera'}
        </Button>
      </form>

      {showCamera && (
        <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-black" style={{ maxWidth: 400 }}>
          <video ref={videoRef} className="w-full" />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-48 h-24 border-2 border-green-400 rounded-lg opacity-60" />
          </div>
        </div>
      )}

      {lastScan && (
        <p className="text-xs text-slate-500">Último código lido: <span className="font-mono font-medium text-slate-700">{lastScan}</span></p>
      )}
    </div>
  );
}
