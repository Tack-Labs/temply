import { Header } from '~/components/header';
import { SiteFooter } from '~/components/marketing/site-footer';

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main id="main-content">{children}</main>
      <SiteFooter />
    </>
  );
}
