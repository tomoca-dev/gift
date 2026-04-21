import { useState, lazy, Suspense } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Loader2, AlertCircle } from "lucide-react";
import logo from "@/assets/logo.png";

const FloatingBeansBackgroundLazy = lazy(() =>
  import("@/components/CoffeeScene").then(m => ({ default: m.FloatingBeansBackground }))
);

const Login = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error, role } = await signIn(email, password);
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      if (role === "cashier") {
        navigate("/cashier");
      } else {
        navigate("/admin");
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-dark px-6 relative overflow-hidden">
      {/* 3D Background */}
      <Suspense fallback={null}>
        <FloatingBeansBackgroundLazy count={20} opacity={0.35} />
      </Suspense>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm relative z-10"
      >
        <div className="flex flex-col items-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="mb-8"
          >
            <img src={logo} alt="TOMOCA Logo" className="w-32 h-32 object-contain drop-shadow-2xl grayscale brightness-150 contrast-125" />
          </motion.div>
          <h1 className="text-2xl font-display font-bold text-foreground">TOMOCA Staff Login</h1>
          <p className="text-muted-foreground text-sm font-body mt-1">Admin & Cashier access</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-body"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </motion.div>
          )}
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full px-4 py-4 rounded-xl bg-secondary/80 backdrop-blur border border-border text-foreground font-body placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/50"
            required
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full px-4 py-4 rounded-xl bg-secondary/80 backdrop-blur border border-border text-foreground font-body placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/50"
            required
          />
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-xl bg-gradient-brass font-body font-semibold text-primary-foreground text-base disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Signing in...</> : "Sign In"}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
};

export default Login;
