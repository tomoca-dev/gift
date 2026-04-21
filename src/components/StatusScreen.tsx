import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";

interface StatusScreenProps {
  type: "not-approved" | "already-redeemed" | "expired";
  onBack: () => void;
}

const config = {
  "not-approved": {
    icon: "🚫",
    title: "Not Eligible",
    message: "This phone number is not on the approved gift list.",
  },
  "already-redeemed": {
    icon: "✓",
    title: "Gift Already Claimed",
    message: "This phone number has already received a gift and cannot claim again.",
  },
  expired: {
    icon: "⏳",
    title: "QR Expired",
    message: "The QR session timed out after 2 minutes. Please ask TOMOCA staff for help if needed.",
  },
};

const StatusScreen = ({ type, onBack }: StatusScreenProps) => {
  const { icon, title, message } = config[type];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-dark">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4">
        <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground font-body text-sm hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
      </motion.div>

      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="w-full max-w-sm text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: "spring" }} className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl">{icon}</span>
          </motion.div>

          <h2 className="text-2xl font-display font-bold text-foreground mb-3">{title}</h2>
          <p className="text-muted-foreground font-body text-sm leading-relaxed mb-8">{message}</p>

          <button onClick={onBack} className="w-full max-w-xs py-3 rounded-xl border border-border text-foreground font-body font-medium hover:bg-secondary transition-colors mx-auto">
            Return
          </button>
        </motion.div>
      </div>
    </div>
  );
};

export default StatusScreen;
