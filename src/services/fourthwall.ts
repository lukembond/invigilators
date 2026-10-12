export interface FourthwallMoney {
  value: number;
  currency: FourthwallCurrency;
}

export const FOURTHWALL_CURRENCIES = [
  { code: "USD", label: "US Dollar" },
  { code: "EUR", label: "Euro" },
  { code: "GBP", label: "British Pound" },
  { code: "AUD", label: "Australian Dollar" },
  { code: "CAD", label: "Canadian Dollar" },
  { code: "NZD", label: "New Zealand Dollar" },
  { code: "SEK", label: "Swedish Krona" },
  { code: "NOK", label: "Norwegian Krone" },
  { code: "DKK", label: "Danish Krone" },
  { code: "PLN", label: "Polish Zloty" },
  { code: "INR", label: "Indian Rupee" },
  { code: "JPY", label: "Japanese Yen" },
  { code: "MYR", label: "Malaysian Ringgit" },
  { code: "SGD", label: "Singapore Dollar" },
  { code: "MXN", label: "Mexican Peso" },
  { code: "BRL", label: "Brazilian Real" },
  { code: "CHF", label: "Swiss Franc" },
] as const;

export type FourthwallCurrency = (typeof FOURTHWALL_CURRENCIES)[number]["code"];

const REGION_CURRENCIES: Record<string, FourthwallCurrency> = {
  US: "USD",
  GB: "GBP",
  AU: "AUD",
  CA: "CAD",
  NZ: "NZD",
  SE: "SEK",
  NO: "NOK",
  DK: "DKK",
  PL: "PLN",
  IN: "INR",
  JP: "JPY",
  MY: "MYR",
  SG: "SGD",
  MX: "MXN",
  BR: "BRL",
  CH: "CHF",
  LI: "CHF",
  AD: "EUR",
  AT: "EUR",
  BE: "EUR",
  CY: "EUR",
  DE: "EUR",
  EE: "EUR",
  ES: "EUR",
  FI: "EUR",
  FR: "EUR",
  GR: "EUR",
  HR: "EUR",
  IE: "EUR",
  IT: "EUR",
  LT: "EUR",
  LU: "EUR",
  LV: "EUR",
  MC: "EUR",
  MT: "EUR",
  NL: "EUR",
  PT: "EUR",
  SI: "EUR",
  SK: "EUR",
  SM: "EUR",
  VA: "EUR",
};

export const isFourthwallCurrency = (currency: string): currency is FourthwallCurrency =>
  FOURTHWALL_CURRENCIES.some(({ code }) => code === currency);

export const getCurrencyFromLocales = (locales: readonly string[]): FourthwallCurrency => {
  for (const locale of locales) {
    const region = locale
      .replace(/_/g, "-")
      .split("-")
      .slice(1)
      .find((subtag) => /^[a-z]{2}$/i.test(subtag));
    const currency = region ? REGION_CURRENCIES[region.toUpperCase()] : undefined;
    if (currency) return currency;
  }

  return "USD";
};

export interface FourthwallImage {
  url: string;
  transformedUrl?: string;
  width?: number;
  height?: number;
}

export interface FourthwallVariant {
  id: string;
  name: string;
  unitPrice: FourthwallMoney;
  compareAtPrice?: FourthwallMoney | null;
  attributes?: {
    description?: string;
    color?: { name: string; swatch: string };
    size?: { name: string };
  };
  stock: { type: string; inStock?: number };
  images: FourthwallImage[];
}

export interface FourthwallProduct {
  type: "PRODUCT";
  id: string;
  name: string;
  slug: string;
  description: string;
  state: { type: string };
  images: FourthwallImage[];
  variants: FourthwallVariant[];
  additionalInformation?: Array<{ title: string; bodyHtml: string }>;
  sizeGuide?: {
    previewUrl?: string;
    fileUrl?: string;
    description?: string;
    fitGuideDescription?: string;
    fitGuideUrls?: string[];
  };
}

export interface FourthwallBundle {
  type: "BUNDLE";
  id: string;
  name: string;
  slug: string;
  description: string;
  state: { type: string };
  images: FourthwallImage[];
  price: FourthwallMoney;
  compareAtPrice?: FourthwallMoney | null;
  offers: FourthwallProduct[];
  additionalInformation?: Array<{ title: string; bodyHtml: string }>;
}

export type FourthwallOffer = FourthwallProduct | FourthwallBundle;

export interface FourthwallCartItem {
  variant: FourthwallVariant & {
    product: { id: string; name: string; slug: string };
  };
  quantity: number;
  groupedBy?: { type: string; bundleId?: string; groupedId?: string };
}

export interface FourthwallCart {
  id: string;
  items: FourthwallCartItem[];
}

export interface FourthwallCartRequestItem {
  variantId: string;
  quantity: number;
  bundleId?: string;
}

export interface FourthwallClientConfig {
  token: string;
  apiUrl: string;
}

export const createFourthwallClient = ({ token, apiUrl }: FourthwallClientConfig) => {
  const endpoint = new URL(apiUrl);

  const request = async <T>(
    path: string,
    init?: RequestInit,
    currency?: FourthwallCurrency
  ): Promise<T> => {
    const url = new URL(`/v1/${path}`, endpoint);
    url.searchParams.set("storefront_token", token);
    if (currency) url.searchParams.set("currency", currency);
    const response = await fetch(url, init);

    if (!response.ok) {
      let detail = `Fourthwall request failed (${response.status})`;
      try {
        const error = (await response.json()) as { code?: string };
        if (error.code) detail = `${detail}: ${error.code}`;
      } catch {
        // Keep the HTTP status when the response has no JSON error body.
      }
      throw new Error(detail);
    }

    return (await response.json()) as T;
  };

  const postItems = (
    path: string,
    items: FourthwallCartRequestItem[],
    currency: FourthwallCurrency
  ) =>
    request<FourthwallCart>(
      path,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      },
      currency
    );

  return {
    async getAllProducts(currency: FourthwallCurrency): Promise<FourthwallOffer[]> {
      const products: FourthwallOffer[] = [];
      let page = 0;
      let hasNextPage = true;

      while (hasNextPage) {
        const result = await request<{
          results: FourthwallOffer[];
          paging?: { hasNextPage?: boolean };
        }>(`collections/all/products?page=${page}&size=50`, undefined, currency);
        products.push(...(result.results ?? []));
        hasNextPage = Boolean(result.paging?.hasNextPage);
        page += 1;
      }

      return products;
    },

    getProduct(slug: string, currency: FourthwallCurrency) {
      return request<FourthwallOffer>(`products/${encodeURIComponent(slug)}`, undefined, currency);
    },

    getCart(cartId: string, currency: FourthwallCurrency) {
      return request<FourthwallCart>(`carts/${encodeURIComponent(cartId)}`, undefined, currency);
    },

    createCart(items: FourthwallCartRequestItem[], currency: FourthwallCurrency) {
      return postItems("carts", items, currency);
    },

    addToCart(cartId: string, items: FourthwallCartRequestItem[], currency: FourthwallCurrency) {
      return postItems(`carts/${encodeURIComponent(cartId)}/add`, items, currency);
    },

    changeCart(cartId: string, items: FourthwallCartRequestItem[], currency: FourthwallCurrency) {
      return postItems(`carts/${encodeURIComponent(cartId)}/change`, items, currency);
    },

    removeFromCart(
      cartId: string,
      items: FourthwallCartRequestItem[],
      currency: FourthwallCurrency
    ) {
      return postItems(`carts/${encodeURIComponent(cartId)}/remove`, items, currency);
    },
  };
};

export const formatFourthwallMoney = ({ value, currency }: FourthwallMoney) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);
