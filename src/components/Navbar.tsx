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
    <nav className="bg-card border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/documents")}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <span className="text-lg font-heading font-bold text-primary">MCKESSON</span>
              <div className="hidden sm:block h-4 w-px bg-border"></div>
            </button>
            <h1 className="text-sm font-heading font-semibold text-foreground hidden sm:block">{title}</h1>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <UserIcon className="w-4 h-4" />
              <span className="hidden sm:inline">{user?.name}</span>
            </div>
            
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-primary hover:bg-muted/50 rounded-lg transition-all"
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
