import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, CameraOff, ScanLine } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";

interface QRScannerProps {
  onScan: (code: string) => void;
}

const QRScanner = ({ onScan }: QRScannerProps) => {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const startScanning = async () => {
    setError(null);
    try {
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          let code = decodedText.trim();
          try {
            const url = new URL(decodedText);
            code = url.searchParams.get("token") || url.searchParams.get("code") || decodedText;
          } catch {
            // keep raw string
          }

          onScan(code.trim());
          stopScanning().catch(() => undefined);
        },
        () => {},
      );
      setScanning(true);
    } catch (err: any) {
      setError(err?.message || "Camera access denied");
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current?.isScanning) {
      await scannerRef.current.stop();
    }
    setScanning(false);
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  return (
    <div className="space-y-3">
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        onClick={scanning ? () => void stopScanning() : () => void startScanning()}
        className={`w-full py-3 rounded-xl font-body font-semibold flex items-center justify-center gap-2 ${
          scanning
            ? "bg-destructive/20 text-destructive border border-destructive/30"
            : "bg-secondary/80 backdrop-blur border border-border text-foreground hover:bg-muted"
        } transition-colors`}
      >
        {scanning ? (
          <>
            <CameraOff className="w-4 h-4" />
            Stop Scanner
          </>
        ) : (
          <>
            <Camera className="w-4 h-4" />
            Scan QR Code
          </>
        )}
      </motion.button>

      <AnimatePresence>
        {scanning && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="relative rounded-xl overflow-hidden border border-border"
          >
            <div id="qr-reader" className="w-full" />
            <motion.div
              className="absolute inset-0 pointer-events-none flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <motion.div
                animate={{ y: [-60, 60, -60] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                <ScanLine className="w-48 h-1 text-primary opacity-60" />
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && <p className="text-destructive text-sm font-body text-center">{error}</p>}
    </div>
  );
};

export default QRScanner;
