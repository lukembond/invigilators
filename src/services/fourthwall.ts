export interface FourthwallMoney {
  value: number;
  currency: string;
}

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

  const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const url = new URL(`/v1/${path}`, endpoint);
    url.searchParams.set("storefront_token", token);
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

  const postItems = (path: string, items: FourthwallCartRequestItem[]) =>
    request<FourthwallCart>(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });

  return {
    async getAllProducts(): Promise<FourthwallOffer[]> {
      const products: FourthwallOffer[] = [];
      let page = 0;
      let hasNextPage = true;

      while (hasNextPage) {
        const result = await request<{
          results: FourthwallOffer[];
          paging?: { hasNextPage?: boolean };
        }>(`collections/all/products?page=${page}&size=50`);
        products.push(...(result.results ?? []));
        hasNextPage = Boolean(result.paging?.hasNextPage);
        page += 1;
      }

      return products;
    },

    getProduct(slug: string) {
      return request<FourthwallOffer>(`products/${encodeURIComponent(slug)}`);
    },

    getCart(cartId: string) {
      return request<FourthwallCart>(`carts/${encodeURIComponent(cartId)}`);
    },

    createCart(items: FourthwallCartRequestItem[]) {
      return postItems("carts", items);
    },

    addToCart(cartId: string, items: FourthwallCartRequestItem[]) {
      return postItems(`carts/${encodeURIComponent(cartId)}/add`, items);
    },

    changeCart(cartId: string, items: FourthwallCartRequestItem[]) {
      return postItems(`carts/${encodeURIComponent(cartId)}/change`, items);
    },

    removeFromCart(cartId: string, items: FourthwallCartRequestItem[]) {
      return postItems(`carts/${encodeURIComponent(cartId)}/remove`, items);
    },
  };
};

export const formatFourthwallMoney = ({ value, currency }: FourthwallMoney) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);