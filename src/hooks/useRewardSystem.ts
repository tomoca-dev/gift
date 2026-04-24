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

// The customer shown on the approved screen — mapped from gift_recipients
export type RewardCustomer = Tables<"gift_recipients"> & {
  // Extra fields surfaced from the claim RPC
  qr_token?: string | null;
  qr_expires_at?: string | null;
  phone?: string;
  reward_type?: string;
  redemption_code?: string;
};

// Shape returned by claim_reward_by_phone RPC
type ClaimRpcRow = {
  customer_id: string | null;
  message: string;
  phone: string | null;
  qr_expires_at: string | null;
  qr_token: string | null;
  redemption_code: string | null;
  reward_type: string | null;
  status: string;
};

// Shape returned by validate_reward_qr RPC
type ValidateRpcRow = {
  customer_id: string | null;
  message: string;
  phone: string | null;
  qr_expires_at: string | null;
  redemption_code: string | null;
  reward_type: string | null;
  status: string;
};

// Shape returned by redeem_reward_qr RPC
type RedeemRpcRow = {
  customer_id: string | null;
  message: string;
  phone: string | null;
  redeemed_at: string | null;
  redemption_code: string | null;
  reward_type: string | null;
  status: string;
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

function mapStatusToRedeemResult(status: string, message: string): RedeemResult {
  const normalized = (status || "").toLowerCase().replace(/_/g, "-");
  if (normalized === "valid" || normalized === "success" || normalized === "approved") return "valid";
  const msg = (message || "").toLowerCase();
  if (msg.includes("already") || normalized === "already-redeemed" || normalized === "already-used") return "already-used";
  if (msg.includes("expir") || normalized === "expired") return "expired";
  return "invalid";
}

export function useRewardSystem() {
  const [status, setStatus] = useState<RewardStatus>("landing");
  const [customer, setCustomer] = useState<RewardCustomer | null>(null);

  const checkPhone = async (phone: string) => {
    setStatus("checking");

    try {
      const { data, error } = await supabase.rpc("claim_reward_by_phone", {
        input_phone: phone,
      });

      if (error) throw error;

      // RPC returns an array
      const rows = data as ClaimRpcRow[] | null;
      const result = Array.isArray(rows) ? rows[0] : null;

      const claimStatus = (result?.status || "").toLowerCase().replace(/_/g, "-");
      const claimSucceeded = ["approved", "valid", "success"].includes(claimStatus);

      if (!result || !claimSucceeded) {
        setCustomer(null);
        const msg = result?.message ?? "Not eligible";
        if (msg.toLowerCase().includes("already") || claimStatus === "already-redeemed" || claimStatus === "already-used") {
          setStatus("already-redeemed");
        } else if (msg.toLowerCase().includes("expir") || claimStatus === "expired") {
          setStatus("expired");
        } else {
          setStatus("not-approved");
          console.warn("Claim rejected:", msg);
        }
        return;
      }

      setCustomer({
        id: result.customer_id ?? crypto.randomUUID(),
        phone_normalized: result.phone ?? phone,
        phone: result.phone ?? phone,
        gift_type: result.reward_type ?? "1 Free Coffee",
        reward_type: result.reward_type ?? "1 Free Coffee",
        redemption_code: result.redemption_code ?? result.qr_token?.slice(-8).toUpperCase() ?? "",
        qr_token: result.qr_token,
        qr_expires_at: result.qr_expires_at,
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
      const { data, error } = await supabase.rpc("validate_reward_qr", {
        input_code: code,
      });

      if (error) {
        return { status: "invalid", message: error.message };
      }

      const rows = data as ValidateRpcRow[] | null;
      const result = Array.isArray(rows) ? rows[0] : null;

      if (!result) {
        return { status: "invalid", message: "QR code not found." };
      }

      const mappedStatus = mapStatusToRedeemResult(result.status, result.message);

      return {
        status: mappedStatus,
        message: result.message,
        phone: result.phone,
        reward_type: result.reward_type,
        redemption_code: result.redemption_code,
        qr_expires_at: result.qr_expires_at,
      };
    } catch (err: any) {
      console.error("validateReward error:", err);
      return { status: "invalid", message: "An unexpected error occurred." };
    }
  };

  const redeemReward = async (code: string): Promise<CashierCheckResult> => {
    try {
      const { data, error } = await supabase.rpc("redeem_reward_qr", {
        input_code: code,
      });

      if (error) {
        return { status: "invalid", message: error.message };
      }

      const rows = data as RedeemRpcRow[] | null;
      const result = Array.isArray(rows) ? rows[0] : null;

      if (!result) {
        return { status: "invalid", message: "Unable to redeem this gift." };
      }

      const mappedStatus = mapStatusToRedeemResult(result.status, result.message);

      return {
        status: mappedStatus,
        message: result.message,
        phone: result.phone,
        reward_type: result.reward_type,
        redemption_code: result.redemption_code,
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
