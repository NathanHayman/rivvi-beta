import { Logo } from "../shared/logos/rivvi-logo";

const AppNavbar: React.FC = () => {
  return (
    <nav className="h-16 flex items-center justify-between sticky top-0 z-50">
      {/* LEFT SIDE */}
      <div>
        <Logo />
      </div>
      {/* RIGHT SIDE */}
      <div>
        <p>User Avatar</p>
      </div>
    </nav>
  );
};

export { AppNavbar };
