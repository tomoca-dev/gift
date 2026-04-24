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

// gift_recipients row + extra fields from the claim RPC
export type RewardCustomer = Tables<"gift_recipients"> & {
  qr_token?: string | null;
  qr_expires_at?: string | null;
  phone?: string;
  reward_type?: string;
  redemption_code?: string;
};

// Shape returned by claim_gift_by_phone RPC (returns jsonb)
type ClaimRpcResult = {
  success: boolean;
  message: string;
  recipient_id: string | null;
  gift_type: string | null;
  phone_normalized: string | null;
  qr_token: string | null;
  expires_at: string | null;
};

// Shape returned by redeem_gift_by_qr RPC (returns jsonb)
type RedeemRpcResult = {
  success: boolean;
  message: string;
  recipient_id: string | null;
  gift_type: string | null;
  redeemed_at: string | null;
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

  // ── Customer-facing: enter phone ──────────────────────────────────────────
  const checkPhone = async (phone: string) => {
    setStatus("checking");

    try {
      const { data, error } = await supabase.rpc("claim_gift_by_phone", {
        input_phone: phone,
      });

      if (error) throw error;

      // The RPC returns jsonb cast to unknown by supabase-js
      const result = data as unknown as ClaimRpcResult;

      if (!result || !result.success) {
        setCustomer(null);
        const msg = result?.message ?? "Not eligible";
        if (msg.toLowerCase().includes("already")) {
          setStatus("already-redeemed");
        } else if (msg.toLowerCase().includes("expir")) {
          setStatus("expired");
        } else {
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
        redemption_code: result.qr_token?.slice(-6).toUpperCase() ?? "",
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

  // ── Cashier: validate QR token WITHOUT redeeming ─────────────────────────
  // No dedicated RPC exists, so we query gift_qr_sessions directly.
  const validateReward = async (code: string): Promise<CashierCheckResult> => {
    try {
      const { data: session, error } = await supabase
        .from("gift_qr_sessions")
        .select("*, gift_recipients(phone_normalized, gift_type, status)")
        .eq("token", code.trim())
        .maybeSingle();

      if (error) {
        return { status: "invalid", message: error.message };
      }

      if (!session) {
        return { status: "invalid", message: "QR code not found." };
      }

      // Session already used
      if (session.used_at) {
        const recipient = session.gift_recipients as any;
        return {
          status: "already-used",
          message: "This QR code has already been used.",
          phone: recipient?.phone_normalized ?? null,
          reward_type: recipient?.gift_type ?? null,
        };
      }

      // Session expired
      if (session.expires_at && new Date(session.expires_at) < new Date()) {
        const recipient = session.gift_recipients as any;
        return {
          status: "expired",
          message: "This QR code has expired.",
          phone: recipient?.phone_normalized ?? null,
          reward_type: recipient?.gift_type ?? null,
          qr_expires_at: session.expires_at,
        };
      }

      const recipient = session.gift_recipients as any;

      // Recipient already redeemed (edge case)
      if (recipient?.status === "redeemed") {
        return {
          status: "already-used",
          message: "Gift already redeemed.",
          phone: recipient?.phone_normalized ?? null,
          reward_type: recipient?.gift_type ?? null,
        };
      }

      return {
        status: "valid",
        message: "Valid — ready to redeem.",
        phone: recipient?.phone_normalized ?? null,
        reward_type: recipient?.gift_type ?? null,
        qr_expires_at: session.expires_at,
      };
    } catch (err: any) {
      console.error("validateReward error:", err);
      return { status: "invalid", message: "An unexpected error occurred." };
    }
  };

  // ── Cashier: redeem the gift ───────────────────────────────────────────────
  const redeemReward = async (token: string): Promise<CashierCheckResult> => {
    try {
      const { data, error } = await supabase.rpc("redeem_gift_by_qr", {
        input_token: token.trim(),
      });

      if (error) {
        return { status: "invalid", message: error.message };
      }

      const result = data as unknown as RedeemRpcResult;

      if (!result || !result.success) {
        const msg = result?.message ?? "Unable to redeem this gift.";
        if (msg.toLowerCase().includes("already")) return { status: "already-used", message: msg };
        if (msg.toLowerCase().includes("expir")) return { status: "expired", message: msg };
        return { status: "invalid", message: msg };
      }

      // Look up the phone for display after redemption
      let phone: string | null = null;
      if (result.recipient_id) {
        const { data: rec } = await supabase
          .from("gift_recipients")
          .select("phone_normalized")
          .eq("id", result.recipient_id)
          .maybeSingle();
        phone = (rec as any)?.phone_normalized ?? null;
      }

      return {
        status: "valid",
        message: result.message,
        phone,
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
