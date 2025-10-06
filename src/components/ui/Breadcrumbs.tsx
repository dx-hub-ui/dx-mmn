'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

function segmentTitle(s: string) { return s.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase()); }

export default function Breadcrumbs() {
  const pathname = usePathname() || '/';
  const parts = pathname.split('/').filter(Boolean);
  const crumbs = [{ href: '/', label: 'Home' }, ...parts.map((p, i) => ({
    href: '/' + parts.slice(0, i + 1).join('/'),
    label: segmentTitle(p)
  }))];
  const last = crumbs[crumbs.length - 1]?.href;

  return (
    <nav aria-label="breadcrumbs" className="breadcrumbs">
      {crumbs.map((c, i) => (
        <span key={c.href} className="flex items-center">
          {i > 0 && <span className="sep">›</span>}
          {c.href === last ? (
            <span aria-current="page">{c.label}</span>
          ) : (
            <Link href={c.href}>{c.label}</Link>
          )}
        </span>
      ))}
    </nav>
  );
}
