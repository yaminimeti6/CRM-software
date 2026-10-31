import type { Metadata } from 'next';
import './style.css';
export const metadata: Metadata = { title: 'Staff CRM', description: 'Secure staff access' };
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><main>{children}</main></body></html>;
}
