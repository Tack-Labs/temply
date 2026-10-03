import { formatUsd, INCLUDED, PRICES_USD, TRIAL_DAYS } from '@temply/shared/plans';
import { JsonLd } from '~/components/json-ld';
import { PUBLIC_PAGES, publicPageMetadata } from '~/lib/seo';
import { PRODUCTION_SITE_URL } from '~/lib/site';
import HomeContent from './home-client';

export const metadata = publicPageMetadata('/');

const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'WebSite', name: 'Temply', url: PRODUCTION_SITE_URL },
    { '@type': 'Organization', name: 'Temply', url: PRODUCTION_SITE_URL, logo: `${PRODUCTION_SITE_URL}/brand/logo.png` },
    {
      '@type': 'SoftwareApplication',
      name: 'Temply',
      url: PRODUCTION_SITE_URL,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description: PUBLIC_PAGES['/'].description,
      offers: [
        {
          '@type': 'Offer',
          name: 'Team',
          description: `${TRIAL_DAYS}-day free trial, no card needed. Includes ${INCLUDED.apiCalls.toLocaleString('en-GB')} API calls a month, then ${formatUsd(PRICES_USD.overagePer1000Calls)} per 1,000 calls.`,
          price: String(PRICES_USD.seat),
          priceCurrency: 'USD',
          priceSpecification: {
            '@type': 'UnitPriceSpecification',
            price: String(PRICES_USD.seat),
            priceCurrency: 'USD',
            unitText: 'user per month',
            referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'MON' },
          },
        },
      ],
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <JsonLd data={structuredData} />
      <HomeContent />
    </>
  );
}
