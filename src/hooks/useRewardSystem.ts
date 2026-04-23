import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type RewardStatus =
  | "landing"
  | "phone-entry"
  | "checking"
  | "approved"
  | "not-approved"
  | "already-redeemed"
  | "expired";

export type RewardCustomer = Tables<"gift_recipients"> & {
  qr_token?: string | null;
  qr_expires_at?: string | null;
  // Compatibility fields
  phone?: string;
  reward_type?: string;
  redemption_code?: string;
};

type ClaimResponse = {
  success: boolean;
  message: string;
  recipient_id: string | null;
  gift_type: string | null;
  phone_normalized: string | null;
  qr_token: string | null;
  expires_at: string | null;
};

export type RedeemResult = "valid" | "already-used" | "expired" | "invalid";
export type CashierCheckResult = {
  status: RedeemResult;
  message: string;
  phone?: string | null;
  reward_type?: string | null;
  redemption_code?: string | null;
  qr_expires_at?: string | null;
};

export function useRewardSystem() {
  const [status, setStatus] = useState<RewardStatus>("landing");
  const [customer, setCustomer] = useState<RewardCustomer | null>(null);

  const checkPhone = async (phone: string) => {
    setStatus("checking");

    try {
      const { data, error } = await supabase.rpc("claim_gift_by_phone", {
        input_phone: phone,
      });

      if (error) throw error;

      const result = data as unknown as ClaimResponse;

      if (!result || !result.success) {
        setCustomer(null);
        if (result?.message?.includes("already")) {
          setStatus("already-redeemed");
        } else {
          setStatus("not-approved");
        }
        return;
      }

      setCustomer({
        id: result.recipient_id ?? crypto.randomUUID(),
        phone_normalized: result.phone_normalized ?? phone,
        phone: result.phone_normalized ?? phone,
        gift_type: result.gift_type ?? "1 Free Coffee",
        reward_type: result.gift_type ?? "1 Free Coffee",
        redemption_code: result.qr_token?.slice(-6).toUpperCase() ?? "", // Use tail of token as fallback code
        qr_token: result.qr_token,
        qr_expires_at: result.expires_at,
        status: "claimed",
        claimed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        redeemed_at: null,
        redeemed_by: null,
        branch_id: null,
        campaign_id: null,
        import_batch_id: null,
        phone_raw: phone,
      } as RewardCustomer);
      setStatus("approved");
    } catch (error) {
      console.error("Claim error:", error);
      setCustomer(null);
      setStatus("not-approved");
    }
  };

  const validateReward = async (code: string): Promise<CashierCheckResult> => {
    // Note: The newer system uses redeem_gift_by_qr for both validation and redemption.
    // For now, we'll keep the stubs or update them if the RPCs are available.
    return { status: "invalid", message: "Validation not implemented in new system." };
  };

  const redeemReward = async (token: string): Promise<CashierCheckResult> => {
    const { data, error } = await supabase.rpc("redeem_gift_by_qr", {
      input_token: token,
    });

    const result = data as any;

    if (error || !result || !result.success) {
      return { status: "invalid", message: result?.message || "Unable to redeem this gift." };
    }

    return {
      status: "valid",
      message: result.message,
      phone: result.recipient_id, // Or use a separate field if available
      reward_type: result.gift_type,
    };
  };

  const reset = () => {
    setStatus("landing");
    setCustomer(null);
  };

  return { status, customer, checkPhone, validateReward, redeemReward, reset, setStatus };
}
