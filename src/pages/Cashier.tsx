import CashierScreen from "@/components/CashierScreen";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useRewardSystem } from "@/hooks/useRewardSystem";

const Cashier = () => {
  const { validateReward, redeemReward } = useRewardSystem();
  return (
    <ProtectedRoute requiredRole="cashier">
      <CashierScreen onValidate={validateReward} onRedeem={redeemReward} />
    </ProtectedRoute>
  );
};

export default Cashier;
