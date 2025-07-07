import { Icons } from "@/components/icons";
import Link from "next/link";

export function Header() {
  return (
    <header className="py-4 px-4 sm:px-6 lg:px-8 border-b bg-card">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <Link href="/" className="flex items-center gap-2 group">
          <Icons.logo className="h-8 w-8 text-primary transition-transform group-hover:scale-110" />
          <h1 className="text-2xl font-headline font-bold text-primary">
            CommitDetective
          </h1>
        </Link>
      </div>
    </header>
  );
}
