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

      // Handle both array and single object responses
      const result = Array.isArray(data) ? (data[0] as unknown as ClaimResponse) : (data as unknown as ClaimResponse);

      if (!result || !result.success) {
        setCustomer(null);
        const msg = result?.message || "Not eligible";
        if (msg.toLowerCase().includes("already")) {
          setStatus("already-redeemed");
        } else {
          // Show actual message if available
          setStatus("not-approved");
          console.warn("Claim rejected:", msg);
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
    try {
      // We use the check_gift_by_qr RPC to validate without redeeming.
      // Falls back to redeem_gift_by_qr if check_gift_by_qr doesn't exist.
      const { data, error } = await supabase.rpc("check_gift_by_qr" as any, {
        input_token: code,
      });

      // If the check RPC doesn't exist, fall back to redeem_gift_by_qr
      if (error && error.code === "42883") {
        // RPC not found — just peek via select on reward_customers
        const { data: row, error: qErr } = await supabase
          .from("reward_customers")
          .select("phone_normalized, gift_type, redemption_code, status, qr_expires_at")
          .eq("qr_token", code)
          .maybeSingle();

        if (qErr || !row) {
          return { status: "invalid", message: "QR code not found." };
        }

        if (row.status === "redeemed") {
          return { status: "already-used", message: "This reward has already been redeemed.", phone: row.phone_normalized, reward_type: row.gift_type, redemption_code: row.redemption_code };
        }

        if (row.qr_expires_at && new Date(row.qr_expires_at) < new Date()) {
          return { status: "expired", message: "This QR code has expired.", phone: row.phone_normalized, reward_type: row.gift_type };
        }

        return {
          status: "valid",
          message: "Valid — ready to redeem.",
          phone: row.phone_normalized,
          reward_type: row.gift_type,
          redemption_code: row.redemption_code,
          qr_expires_at: row.qr_expires_at,
        };
      }

      if (error) {
        return { status: "invalid", message: error.message };
      }

      const result = data as any;
      if (!result || !result.success) {
        const msg: string = result?.message ?? "Invalid code.";
        if (msg.toLowerCase().includes("already")) return { status: "already-used", message: msg };
        if (msg.toLowerCase().includes("expir")) return { status: "expired", message: msg };
        return { status: "invalid", message: msg };
      }

      return {
        status: "valid",
        message: result.message ?? "Valid — ready to redeem.",
        phone: result.phone_normalized ?? result.phone,
        reward_type: result.gift_type ?? result.reward_type,
        redemption_code: result.redemption_code,
        qr_expires_at: result.expires_at,
      };
    } catch (err: any) {
      console.error("validateReward error:", err);
      return { status: "invalid", message: "An unexpected error occurred." };
    }
  };

  const redeemReward = async (token: string): Promise<CashierCheckResult> => {
    try {
      const { data, error } = await supabase.rpc("redeem_gift_by_qr", {
        input_token: token,
      });

      const result = data as any;

      if (error || !result || !result.success) {
        const msg: string = result?.message || error?.message || "Unable to redeem this gift.";
        if (msg.toLowerCase().includes("already")) return { status: "already-used", message: msg };
        if (msg.toLowerCase().includes("expir")) return { status: "expired", message: msg };
        return { status: "invalid", message: msg };
      }

      return {
        status: "valid",
        message: result.message,
        phone: result.phone_normalized ?? result.recipient_id,
        reward_type: result.gift_type,
      };
    } catch (err: any) {
      console.error("redeemReward error:", err);
      return { status: "invalid", message: "An unexpected error occurred." };
    }
  };

  const reset = () => {
    setStatus("landing");
    setCustomer(null);
  };

  return { status, customer, checkPhone, validateReward, redeemReward, reset, setStatus };
}
