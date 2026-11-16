import type { Metadata } from 'next';
import './style.css';
import './crm-shell.css';
import './crm-workspace.css';
export const metadata: Metadata = { title: 'Staff CRM', description: 'Secure staff access' };
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><main>{children}</main></body></html>;
}
