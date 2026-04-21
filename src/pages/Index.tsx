import LandingScreen from "@/components/LandingScreen";
import PhoneEntryScreen from "@/components/PhoneEntryScreen";
import ApprovedScreen from "@/components/ApprovedScreen";
import StatusScreen from "@/components/StatusScreen";
import { useRewardSystem } from "@/hooks/useRewardSystem";

const Index = () => {
  const { status, customer, checkPhone, reset, setStatus } = useRewardSystem();

  if (status === "landing") {
    return <LandingScreen onStart={() => setStatus("phone-entry")} />;
  }

  if (status === "phone-entry" || status === "checking") {
    return (
      <PhoneEntryScreen
        onSubmit={checkPhone}
        onBack={reset}
        isChecking={status === "checking"}
      />
    );
  }

  if (status === "approved" && customer) {
    return <ApprovedScreen customer={customer} />;
  }

  if (status === "not-approved" || status === "already-redeemed" || status === "expired") {
    return <StatusScreen type={status} onBack={reset} />;
  }

  return <LandingScreen onStart={() => setStatus("phone-entry")} />;
};

export default Index;
