import { useState } from "react";
import { motion } from "framer-motion";
import { UserPlus, X, Gift, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { normalizeEthiopianPhone } from "@/lib/phone";

interface AddCustomerDialogProps {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}

const REWARD_OPTIONS = [
  "1 Free Macchiato",
  "1 Free Cappuccino",
  "1 Free Latte",
  "1 Free Espresso",
  "1 Free Pastry",
  "10% Off Next Visit",
  "Buy 1 Get 1 Free",
];

const AddCustomerDialog = ({ open, onClose, onAdded }: AddCustomerDialogProps) => {
  const [phone, setPhone] = useState("");
  const [rewardType, setRewardType] = useState(REWARD_OPTIONS[0]);
  const [customReward, setCustomReward] = useState("");
  const [loading, setLoading] = useState(false);
  const [useCustom, setUseCustom] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeEthiopianPhone(phone);
    if (!normalized) {
      toast.error("Please enter a valid phone number");
      return;
    }

    setLoading(true);
    const reward = useCustom ? customReward : rewardType;

    const { error } = await supabase.from("gift_recipients").upsert(
      { phone_raw: phone, phone_normalized: normalized, gift_type: reward, status: "eligible" },
      { onConflict: "phone_normalized" },
    );

    setLoading(false);

    if (error) {
      toast.error(`Failed to add customer: ${error.message}`);
      return;
    }

    toast.success(`Reward assigned to ${normalized}`);
    setPhone("");
    setCustomReward("");
    setUseCustom(false);
    onAdded();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative z-10 w-full max-w-md glass-card rounded-2xl p-6 mx-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-brass flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-primary-foreground" />
            </div>
            <h2 className="font-display font-bold text-lg text-foreground">Assign Reward</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-body text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <Phone className="w-3 h-3" /> Phone Number
            </label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+251 9XX XXX XXXX" className="w-full px-4 py-3 rounded-xl bg-secondary/80 border border-border text-foreground font-body placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>

          <div>
            <label className="text-xs font-body text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <Gift className="w-3 h-3" /> Reward Type
            </label>
            {!useCustom ? (
              <div className="space-y-2">
                <select value={rewardType} onChange={(e) => setRewardType(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-secondary/80 border border-border text-foreground font-body focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none">
                  {REWARD_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={() => setUseCustom(true)} className="text-xs font-body text-primary hover:underline">
                  + Custom reward
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <input type="text" value={customReward} onChange={(e) => setCustomReward(e.target.value)} placeholder="e.g. 2 Free Macchiatos" className="w-full px-4 py-3 rounded-xl bg-secondary/80 border border-border text-foreground font-body placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/50" />
                <button type="button" onClick={() => setUseCustom(false)} className="text-xs font-body text-primary hover:underline">
                  ← Choose from presets
                </button>
              </div>
            )}
          </div>

          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} type="submit" disabled={loading || !phone.trim()} className="w-full py-3 rounded-xl bg-gradient-brass font-body font-semibold text-primary-foreground disabled:opacity-50 mt-2">
            {loading ? "Assigning..." : "Assign Reward"}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
};

export default AddCustomerDialog;
