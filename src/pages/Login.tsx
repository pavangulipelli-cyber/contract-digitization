import { useState, useEffect, FormEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ShieldIcon } from "@/components/icons/Icons";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const from = location.state?.from?.pathname || "/documents";

  useEffect(() => {
    console.info("[Login] Page mounted", { redirectTarget: from });
  }, [from]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    
    try {
      console.info("[Login] Submitting login", { email, redirectTarget: from });
      const success = await login(email, password);
      if (success) {
        console.info("[Login] Login success, navigating", { redirectTarget: from });
        navigate(from, { replace: true });
      } else {
        console.warn("[Login] Invalid credentials", { email });
        setError("Invalid email or password.");
      }
    } catch {
      console.error("[Login] Unexpected error during login");
      setError("An error occurred. Please try again.");
    } finally {
      console.info("[Login] Login attempt finished");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="bg-card rounded-xl card-shadow-lg p-8">
          {/* Logo/Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center">
              <ShieldIcon className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          
          {/* Title */}
          <h1 className="text-2xl font-semibold text-foreground text-center mb-2">
            Contract AI Review Portal
          </h1>
          <p className="text-muted-foreground text-center mb-8">
            Sign in to access your dashboard
          </p>
          
          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="admin@contract.ai"
                required
                autoComplete="email"
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>
            
            {error && (
              <p className="text-destructive text-sm font-medium animate-fade-in">
                {error}
              </p>
            )}
            
            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-primary py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Signing in..." : "Login"}
            </button>
          </form>
          
          {/* Demo hint */}
          <p className="text-xs text-muted-foreground text-center mt-6">
            Demo: admin@contract.ai / password123
          </p>
        </div>
      </div>
    </div>
  );
}
