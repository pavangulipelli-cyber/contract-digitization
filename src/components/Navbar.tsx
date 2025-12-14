import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { LogOutIcon, UserIcon } from "@/components/icons/Icons";

interface NavbarProps {
  title: string;
}

export function Navbar({ title }: NavbarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="bg-card border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <UserIcon className="w-4 h-4" />
              <span className="hidden sm:inline">{user?.name}</span>
            </div>
            
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            >
              <LogOutIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
