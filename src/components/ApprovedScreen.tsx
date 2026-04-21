import { motion } from "framer-motion";
import { CheckCircle2, Coffee, Copy, Clock3 } from "lucide-react";
import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { RewardCustomer } from "@/hooks/useRewardSystem";
import { maskPhone } from "@/lib/phone";

const FloatingBeansBackgroundLazy = lazy(() =>
  import("@/components/CoffeeScene").then((m) => ({ default: m.FloatingBeansBackground })),
);

interface ApprovedScreenProps {
  customer: RewardCustomer;
}

const ApprovedScreen = ({ customer }: ApprovedScreenProps) => {
  const [copied, setCopied] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(120);

  const qrValue = useMemo(() => {
    const token = customer.qr_token || customer.redemption_code;
    return `${window.location.origin}/cashier?token=${encodeURIComponent(token)}`;
  }, [customer.qr_token, customer.redemption_code]);

  useEffect(() => {
    if (!customer.qr_expires_at) return;

    const update = () => {
      const diff = Math.max(0, Math.floor((new Date(customer.qr_expires_at!).getTime() - Date.now()) / 1000));
      setSecondsLeft(diff);
    };

    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [customer.qr_expires_at]);

  const handleCopy = () => {
    navigator.clipboard.writeText(customer.redemption_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const seconds = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-dark p-6 relative overflow-hidden">
      <Suspense fallback={null}>
        <FloatingBeansBackgroundLazy count={20} opacity={0.3} />
      </Suspense>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="w-20 h-20 rounded-full bg-gradient-brass flex items-center justify-center mx-auto mb-6 glow-brass"
        >
          <CheckCircle2 className="w-10 h-10 text-primary-foreground" />
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-3xl font-display font-bold text-foreground mb-2"
        >
          Gift Ready
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-muted-foreground font-body text-sm mb-8"
        >
          {maskPhone(customer.phone)} has been approved for a one-time TOMOCA gift.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="glass-card rounded-2xl p-6 mb-6 backdrop-blur"
        >
          <div className="w-12 h-12 rounded-full bg-gradient-brass flex items-center justify-center mx-auto mb-4">
            <Coffee className="w-6 h-6 text-primary-foreground" />
          </div>

          <p className="text-primary font-body text-xs tracking-[0.2em] uppercase mb-2">Your Gift</p>
          <h3 className="text-2xl font-display font-bold text-gradient-brass mb-4">{customer.reward_type}</h3>

          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 mb-4 text-primary font-body text-sm">
            <Clock3 className="w-4 h-4" />
            QR expires in {minutes}:{seconds}
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8 }}
            className="bg-white rounded-xl p-4 mx-auto mb-4 inline-block"
          >
            <QRCodeSVG value={qrValue} size={160} bgColor="#ffffff" fgColor="#1a1008" level="H" />
          </motion.div>

          <div className="bg-secondary/50 rounded-xl p-4 flex items-center justify-between gap-4 text-left">
            <div>
              <p className="text-muted-foreground text-xs font-body mb-1">Cashier backup code</p>
              <p className="text-xl font-body font-bold tracking-[0.15em] text-foreground">{customer.redemption_code}</p>
            </div>
            <button onClick={handleCopy} className="p-2 rounded-lg hover:bg-muted transition-colors">
              <Copy className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          {copied && <p className="text-success text-xs mt-2 font-body">Backup code copied.</p>}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="glass-card rounded-xl p-4"
        >
          <p className="text-muted-foreground text-xs font-body leading-relaxed">
            Show this QR to the cashier within 2 minutes. Once this number has claimed the gift, it cannot claim again.
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default ApprovedScreen;
