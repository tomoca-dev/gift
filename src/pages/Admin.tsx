import AdminDashboard from "@/components/AdminDashboard";
import ProtectedRoute from "@/components/ProtectedRoute";

const Admin = () => (
  <ProtectedRoute requiredRole="admin">
    <AdminDashboard />
  </ProtectedRoute>
);

export default Admin;
