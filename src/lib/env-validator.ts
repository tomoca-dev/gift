/**
 * This utility ensures that all required environment variables are present at runtime.
 * It should be called at the very beginning of the application lifecycle.
 */
export const validateEnv = () => {
  const required = [
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_PROJECT_ID",
  ];

  const missing = required.filter((key) => !import.meta.env[key]);

  if (missing.length > 0) {
    const errorMsg = `CRITICAL ERROR: Missing required environment variables: ${missing.join(", ")}. Please check your .env file.`;
    console.error(errorMsg);
    
    // In a production app, we might want to show a full-screen error or alert
    if (typeof window !== "undefined") {
      alert(errorMsg);
    }
    
    throw new Error(errorMsg);
  }

  console.log("Environment variables validated successfully.");
};
