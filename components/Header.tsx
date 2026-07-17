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
          <Link href="/new" className="nav-link hide-mobile">
            New bracket
          </Link>
          <Link href="/dashboard" className="nav-link">
            My brackets
          </Link>
          <AuthNav />
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
