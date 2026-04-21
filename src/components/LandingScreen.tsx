import { motion } from "framer-motion";
import { LogIn } from "lucide-react";
import logo from "@/assets/logo.png";
import { lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";

const CoffeeScene = lazy(() => import("@/components/CoffeeScene"));

interface LandingScreenProps {
  onStart: () => void;
}

const LandingScreen = ({ onStart }: LandingScreenProps) => {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-gradient-dark">
      {/* Staff Login Button */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.3 }}
        onClick={() => navigate("/login")}
        className="absolute top-5 right-5 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/40 backdrop-blur border border-border/50 text-muted-foreground/70 hover:text-foreground hover:bg-secondary/70 transition-all font-body text-xs"
      >
        <LogIn className="w-3.5 h-3.5" />
        Staff
      </motion.button>
      {/* 3D Scene */}
      <Suspense fallback={null}>
        <CoffeeScene />
      </Suspense>

      {/* Gradient overlay for readability */}
      <div className="absolute inset-0 z-[1] bg-gradient-to-t from-background via-background/60 to-transparent pointer-events-none" />

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 flex flex-col items-center text-center px-6 max-w-md"
      >
        {/* Logo mark */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
          className="flex items-center justify-center mb-10"
        >
          <img src={logo} alt="TOMOCA Logo" className="w-64 h-64 md:w-80 md:h-80 object-contain drop-shadow-2xl" />
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-brass-glow font-body text-sm tracking-[0.3em] uppercase mb-4"
        >
          TOMOCA COFFEE
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-4xl md:text-5xl font-display font-bold leading-tight mb-6 text-gradient-brass"
        >
          Unlock Your TOMOCA Reward
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="text-muted-foreground font-body text-base leading-relaxed mb-10"
        >
          A limited thank-you for our most valued customers. Enter your number to discover your exclusive reward.
        </motion.p>

        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={onStart}
          className="w-full max-w-xs py-4 px-8 rounded-xl bg-gradient-brass font-body font-semibold text-primary-foreground text-lg tracking-wide shadow-lg transition-all"
        >
          Enter Your Number
        </motion.button>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
          className="text-muted-foreground/60 text-xs mt-6 font-body"
        >
          One reward per approved customer
        </motion.p>
      </motion.div>
    </div>
  );
};

export default LandingScreen;
