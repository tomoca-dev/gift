import { useState, lazy, Suspense } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Phone, Loader2 } from "lucide-react";
import { normalizeEthiopianPhone } from "@/lib/phone";

const FloatingBeansBackgroundLazy = lazy(() =>
  import("@/components/CoffeeScene").then((m) => ({ default: m.FloatingBeansBackground })),
);

interface PhoneEntryScreenProps {
  onSubmit: (phone: string) => void;
  onBack: () => void;
  isChecking: boolean;
}

const PhoneEntryScreen = ({ onSubmit, onBack, isChecking }: PhoneEntryScreenProps) => {
  const [phone, setPhone] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeEthiopianPhone(phone);
    if (normalized) onSubmit(normalized);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-dark relative overflow-hidden">
      <Suspense fallback={null}>
        <FloatingBeansBackgroundLazy count={18} opacity={0.3} />
      </Suspense>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative z-10 p-4">
        <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground font-body text-sm hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
      </motion.div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="w-full max-w-sm">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }} className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center mb-6 mx-auto">
            <Phone className="w-6 h-6 text-primary" />
          </motion.div>

          <h2 className="text-2xl font-display font-bold text-center mb-2 text-foreground">Claim Your Gift</h2>
          <p className="text-muted-foreground text-center font-body text-sm mb-8">Enter the phone number that the TOMOCA team approved for this one-time gift.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-body text-sm">+251</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="9XX XXX XXXX"
                className="w-full pl-16 pr-4 py-4 rounded-xl bg-secondary/80 backdrop-blur border border-border text-foreground font-body text-lg tracking-wide placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                disabled={isChecking}
                autoFocus
              />
            </div>

            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" disabled={!phone.trim() || isChecking} className="w-full py-4 rounded-xl bg-gradient-brass font-body font-semibold text-primary-foreground text-base tracking-wide shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all">
              {isChecking ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Checking...
                </>
              ) : (
                "Claim Gift"
              )}
            </motion.button>
          </form>

          <p className="text-muted-foreground/50 text-xs text-center mt-6 font-body">Each approved phone number can claim only once.</p>
        </motion.div>
      </div>
    </div>
  );
};

export default PhoneEntryScreen;
