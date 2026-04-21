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

export type RewardCustomer = Tables<"reward_customers"> & {
  qr_token?: string | null;
  qr_expires_at?: string | null;
};

type ClaimResponse = {
  customer_id: string | null;
  message: string;
  phone: string | null;
  qr_expires_at: string | null;
  qr_token: string | null;
  redemption_code: string | null;
  reward_type: string | null;
  status: Exclude<RewardStatus, "landing" | "phone-entry" | "checking"> | "approved";
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

    const { data, error } = await supabase.rpc("claim_reward_by_phone", {
      input_phone: phone,
    });

    const result = (data as ClaimResponse[] | null)?.[0];

    if (error || !result) {
      setCustomer(null);
      setStatus("not-approved");
      return;
    }

    if (result.status !== "approved") {
      setCustomer(null);
      setStatus(result.status);
      return;
    }

    setCustomer({
      id: result.customer_id ?? crypto.randomUUID(),
      phone: result.phone ?? phone,
      reward_type: result.reward_type ?? "1 Free Macchiato",
      redemption_code: result.redemption_code ?? "",
      qr_token: result.qr_token,
      qr_expires_at: result.qr_expires_at,
      status: "claimed",
      claimed_at: new Date().toISOString(),
      claim_expires_at: result.qr_expires_at,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      redeemed_at: null,
      redeemed_by: null,
      store_name: null,
      imported_by: null,
      import_source: null,
    } as RewardCustomer);
    setStatus("approved");
  };

  const validateReward = async (code: string): Promise<CashierCheckResult> => {
    const { data, error } = await supabase.rpc("validate_reward_qr", {
      input_code: code,
    });

    const result = (data as CashierCheckResult[] | null)?.[0];

    if (error || !result) {
      return { status: "invalid", message: "Invalid QR or code." };
    }

    return result;
  };

  const redeemReward = async (code: string): Promise<CashierCheckResult> => {
    const { data, error } = await supabase.rpc("redeem_reward_qr", {
      input_code: code,
    });

    const result = (data as CashierCheckResult[] | null)?.[0];

    if (error || !result) {
      return { status: "invalid", message: "Unable to redeem this gift." };
    }

    return result;
  };

  const reset = () => {
    setStatus("landing");
    setCustomer(null);
  };

  return { status, customer, checkPhone, validateReward, redeemReward, reset, setStatus };
}
