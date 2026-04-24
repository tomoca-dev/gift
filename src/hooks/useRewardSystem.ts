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
  phone?: string;
  reward_type?: string;
  redemption_code?: string;
};

type ClaimRpcRow = {
  customer_id: string | null;
  message: string;
  phone: string | null;
  qr_expires_at: string | null;
  qr_token: string | null;
  redemption_code: string | null;
  reward_type?: string | null;
  gift_type?: string | null;
  status: string;
};

type ValidateRpcRow = {
  customer_id: string | null;
  message: string;
  phone: string | null;
  qr_expires_at: string | null;
  redemption_code: string | null;
  reward_type?: string | null;
  gift_type?: string | null;
  status: string;
};

type RedeemRpcRow = {
  customer_id: string | null;
  message: string;
  phone: string | null;
  redeemed_at: string | null;
  redemption_code: string | null;
  reward_type?: string | null;
  gift_type?: string | null;
  status: string;
};

export type RedeemResult = "valid" | "already-used" | "expired" | "invalid";

export type CashierCheckResult = {
  status: RedeemResult;
  message: string;
  phone?: string | null;
  reward_type?: string | null;
  gift_type?: string | null;
  redemption_code?: string | null;
  qr_expires_at?: string | null;
};

function firstRpcRow<T>(data: unknown): T | null {
  if (Array.isArray(data)) return (data[0] as T) ?? null;
  if (data && typeof data === "object") return data as T;
  return null;
}

function getGiftType(row?: { gift_type?: string | null; reward_type?: string | null } | null) {
  return row?.gift_type ?? row?.reward_type ?? "1 Free Coffee";
}

function mapStatusToRedeemResult(status: string, message: string): RedeemResult {
  const normalized = (status || "").toLowerCase().replace(/_/g, "-");
  const msg = (message || "").toLowerCase();

  if (["valid", "success", "approved"].includes(normalized)) return "valid";
  if (msg.includes("already") || ["already-redeemed", "already-used"].includes(normalized)) {
    return "already-used";
  }
  if (msg.includes("expir") || normalized === "expired") return "expired";

  return "invalid";
}

export function useRewardSystem() {
  const [status, setStatus] = useState<RewardStatus>("landing");
  const [customer, setCustomer] = useState<RewardCustomer | null>(null);

  const checkPhone = async (phone: string) => {
    setStatus("checking");

    try {
      console.log("PHONE SENT TO SUPABASE:", phone);

      const { data, error } = await supabase.rpc("claim_reward_by_phone", {
        input_phone: phone,
      });

      console.log("CLAIM DATA:", data);
      console.log("CLAIM ERROR:", error);

      if (error) throw error;

      const result = firstRpcRow<ClaimRpcRow>(data);
      const claimStatus = (result?.status || "").toLowerCase().replace(/_/g, "-");
      const claimSucceeded = ["approved", "valid", "success"].includes(claimStatus);

      if (!result || !claimSucceeded) {
        setCustomer(null);

        const msg = result?.message ?? "Not eligible";

        if (
          msg.toLowerCase().includes("already") ||
          claimStatus === "already-redeemed" ||
          claimStatus === "already-used"
        ) {
          setStatus("already-redeemed");
        } else if (msg.toLowerCase().includes("expir") || claimStatus === "expired") {
          setStatus("expired");
        } else {
          setStatus("not-approved");
          console.warn("Claim rejected:", msg);
        }

        return;
      }

      const giftType = getGiftType(result);

      setCustomer({
        id: result.customer_id ?? crypto.randomUUID(),
        phone_normalized: result.phone ?? phone,
        phone: result.phone ?? phone,
        gift_type: giftType,
        reward_type: giftType,
        redemption_code:
          result.redemption_code ?? result.qr_token?.slice(-8).toUpperCase() ?? "",
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
      const cleanCode = code.trim();

      const { data, error } = await supabase.rpc("validate_reward_qr", {
        input_code: cleanCode,
      });

      if (error) {
        console.error("validateReward RPC error:", error);
        return { status: "invalid", message: error.message };
      }

      const result = firstRpcRow<ValidateRpcRow>(data);

      if (!result) {
        return { status: "invalid", message: "QR code not found." };
      }

      const giftType = getGiftType(result);

      return {
        status: mapStatusToRedeemResult(result.status, result.message),
        message: result.message,
        phone: result.phone,
        reward_type: giftType,
        gift_type: giftType,
        redemption_code: result.redemption_code,
        qr_expires_at: result.qr_expires_at,
      };
    } catch (err) {
      console.error("validateReward error:", err);
      return { status: "invalid", message: "An unexpected error occurred." };
    }
  };

  const redeemReward = async (code: string): Promise<CashierCheckResult> => {
    try {
      const cleanCode = code.trim();

      const { data, error } = await supabase.rpc("redeem_reward_qr", {
        input_code: cleanCode,
      });

      if (error) {
        console.error("redeemReward RPC error:", error);
        return { status: "invalid", message: error.message };
      }

      const result = firstRpcRow<RedeemRpcRow>(data);

      if (!result) {
        return { status: "invalid", message: "Unable to redeem this gift." };
      }

      const giftType = getGiftType(result);

      return {
        status: mapStatusToRedeemResult(result.status, result.message),
        message: result.message,
        phone: result.phone,
        reward_type: giftType,
        gift_type: giftType,
        redemption_code: result.redemption_code,
      };
    } catch (err) {
      console.error("redeemReward error:", err);
      return { status: "invalid", message: "An unexpected error occurred." };
    }
  };

  const reset = () => {
    setStatus("landing");
    setCustomer(null);
  };

  return {
    status,
    customer,
    checkPhone,
    validateReward,
    redeemReward,
    reset,
    setStatus,
  };
}