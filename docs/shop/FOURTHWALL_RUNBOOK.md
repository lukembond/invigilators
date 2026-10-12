# Fourthwall Shop Connectivity Runbook

This site is a statically generated Astro site. Its shop requests the Fourthwall
Storefront API from the browser, keeps the cart in the browser, and redirects to
Fourthwall-hosted checkout. Payment details are never collected by this site.

## Credentials and configuration

1. In Fourthwall, open **Settings > For Developers > Headless** and create/copy
   a public Storefront API token.
2. Copy `.env.example` to `.env` and set:
   - `PUBLIC_FOURTHWALL_STOREFRONT_TOKEN` to that public storefront token.
   - `PUBLIC_FOURTHWALL_SHOP_DOMAIN` to the shop host, without `https://` or a
     trailing slash (for example, `your-shop.fourthwall.com`).
   - `PUBLIC_FOURTHWALL_STOREFRONT_API_URL` to
     `https://storefront-api.fourthwall.com`, unless Fourthwall supplies a
     different host.
3. In GitHub, open **Settings > Secrets and variables > Actions > Variables** and
   add repository variables named `PUBLIC_FOURTHWALL_STOREFRONT_TOKEN` and
   `PUBLIC_FOURTHWALL_SHOP_DOMAIN`. The Pages deploy workflow passes them to the
   Astro build. The API URL defaults to
   `https://storefront-api.fourthwall.com`.
4. Astro embeds `PUBLIC_` variables in client assets. Fourthwall's Storefront
   token is intended for public storefront requests: the API requires it as a
   `storefront_token` query parameter and documents catalog access and cart
   operations for custom frontends. Treat it as public, not as an admin secret;
   never use an Open API user credential, password, OAuth client secret, or
   other private credential here. GitHub Actions variables are appropriate;
   do not use them for private credentials.
5. Keep `.env` out of version control. `.env.example` contains placeholders only.

## Connectivity checks

Run these from a terminal with `jq` installed, replacing the token first:

```sh
export FOURTHWALL_STOREFRONT_TOKEN='your-public-storefront-token'
export FOURTHWALL_STOREFRONT_API_URL='https://storefront-api.fourthwall.com'

curl --fail-with-body --silent --show-error \
  "$FOURTHWALL_STOREFRONT_API_URL/v1/shop?storefront_token=$FOURTHWALL_STOREFRONT_TOKEN" | jq .

curl --fail-with-body --silent --show-error \
  "$FOURTHWALL_STOREFRONT_API_URL/v1/collections?storefront_token=$FOURTHWALL_STOREFRONT_TOKEN" | jq .
```

Both requests should return JSON with HTTP 2xx. The collections response should
include published collections. To verify an individual collection, use its
handle:

```sh
export FOURTHWALL_COLLECTION_HANDLE='your-collection-handle'
curl --fail-with-body --silent --show-error \
  "$FOURTHWALL_STOREFRONT_API_URL/v1/collections/$FOURTHWALL_COLLECTION_HANDLE/products?storefront_token=$FOURTHWALL_STOREFRONT_TOKEN" | jq .
```

## Local site check

```sh
npm install
npm run dev
```

Open `/shop`, confirm product cards and details load, add a product to the cart,
and verify the cart count and item totals update. Use the checkout action only
when ready to leave the site; it must redirect to the configured Fourthwall
shop's hosted checkout. Do not submit a real order as a connectivity test.

The currency selector initially uses the country region in the browser locale
(for example, `en-GB` selects GBP). This is a convenience default, not precise
geolocation; shoppers can override it, and their choice persists in local
storage. Product/cart requests and checkout use the selected currency.

For a production build, provide the variables to the build process first, then
run `npm run build`. A successful local API request does not confirm that the
production host permits browser requests; check the browser console and Network
panel on the deployed `/shop` page if products do not load.

## Troubleshooting

- **401/403:** Recheck that the value is the public Storefront token and that it
  has not been copied with whitespace. Do not substitute a private API token.
- **404 or empty catalog:** Check the API base URL, collection handle, and that
  products are published in Fourthwall.
- **Browser CORS/network error:** Confirm the exact failing request in DevTools.
  If the Storefront API does not allow the production origin, a server-side
  proxy/runtime will be needed; do not work around this by exposing private
  credentials.
- **Checkout goes to the wrong shop:** Check the configured shop domain and
  verify it matches the shop that owns the storefront token.
- **Variables appear missing:** Astro reads `.env` at dev/build startup. Restart
  the dev server after changing local variables, and rebuild after changing
  deployment variables.

## Checkout boundary

The Storefront API supports product/catalog reads and cart operations. Checkout
is intentionally completed on Fourthwall, which handles shipping, tax, payment,
and order confirmation. The cart and product/detail UI remain on this site; this
integration does not embed payment fields or handle card data.
