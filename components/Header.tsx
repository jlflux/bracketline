import Link from "next/link";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";
import AuthNav from "./AuthNav";

export default function Header() {
  return (
    <header className="site-header">
      <div className="container inner">
        <Link href="/" className="logo">
          <Logo />
          Bracketline
        </Link>
        <nav className="header-nav">
          {/* AuthNav owns the links that depend on who's signed in. */}
          <AuthNav />
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
