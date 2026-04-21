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

        </form>
      </motion.div>
    </div>
  );
};
      </motion.div>
    </div>
  );
};

export default Login;
