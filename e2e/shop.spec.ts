import { expect, test } from "@playwright/test";

const product = {
  type: "PRODUCT",
  id: "product-1",
  name: "Invigilators Tee",
  slug: "invigilators-tee",
  description:
    "<p>A test product for the shop overlay.</p><p>Printed <strong>front and back</strong>.</p>",
  state: { type: "AVAILABLE" },
  access: { type: "PUBLIC" },
  images: [
    {
      url: "https://images.example.com/tee.jpg",
      transformedUrl: "https://images.example.com/tee.jpg",
      width: 800,
      height: 800,
    },
    {
      url: "https://images.example.com/tee-back.jpg",
      transformedUrl: "https://images.example.com/tee-back.jpg",
      width: 800,
      height: 800,
    },
  ],
  variants: [
    {
      id: "variant-s",
      name: "Small",
      unitPrice: { value: 24, currency: "USD" },
      attributes: { description: "Small" },
      stock: { type: "UNLIMITED" },
      images: [],
    },
    {
      id: "variant-l",
      name: "Large",
      unitPrice: { value: 28, currency: "USD" },
      attributes: { description: "Large" },
      stock: { type: "UNLIMITED" },
      images: [],
    },
  ],
  additionalInformation: [
    { title: "Care", bodyHtml: "<p>Wash cold.</p><ul><li>Hang dry</li></ul>" },
  ],
};

const makeCart = (quantity: number) => ({
  id: "cart-1",
  items: [
    {
      variant: {
        id: "variant-l",
        name: "Large",
        sku: "TEE-L",
        unitPrice: { value: 28, currency: "USD" },
        attributes: { description: "Large" },
        stock: { type: "UNLIMITED" },
        images: product.images,
        product: { id: product.id, name: product.name, slug: product.slug },
      },
      quantity,
    },
  ],
});

test.describe("Fourthwall shop", () => {
  test("renders products, opens details, manages cart, and redirects to checkout", async ({
    page,
  }) => {
    let cart = makeCart(1);

    await page.route("https://storefront-api.fourthwall.com/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());

      if (url.pathname === "/v1/collections/all/products") {
        await route.fulfill({ json: { results: [product], paging: { hasNextPage: false } } });
        return;
      }

      if (url.pathname === "/v1/carts" && request.method() === "POST") {
        const body = request.postDataJSON() as { items: Array<{ variantId: string }> };
        expect(body.items[0]?.variantId).toBe("variant-l");
        cart = makeCart(1);
        await route.fulfill({ json: cart });
        return;
      }

      if (url.pathname === "/v1/carts/cart-1" && request.method() === "GET") {
        await route.fulfill({ json: cart });
        return;
      }

      if (url.pathname === "/v1/carts/cart-1/change" && request.method() === "POST") {
        const body = request.postDataJSON() as { items: Array<{ quantity: number }> };
        cart = makeCart(body.items[0]?.quantity ?? 1);
        await route.fulfill({ json: cart });
        return;
      }

      await route.fulfill({ status: 404, json: { code: "NOT_FOUND" } });
    });

    await page.route("https://shop.example.com/checkout/**", async (route) => {
      await route.fulfill({ contentType: "text/html", body: "<title>Fourthwall checkout</title>" });
    });

    await page.goto("/shop/");
    await expect(page.locator("#shop-product-count")).toHaveText("1 Item");
    await expect(page.getByRole("heading", { name: product.name })).toBeVisible();
    await expect(page.locator("#mixes-nav-link")).toContainText(/Mixes/);
    const cardImage = page.locator("#shop-products-list article img").first();
    await expect(cardImage).toHaveAttribute("src", product.images[0].url);
    await page.getByRole("button", { name: `View ${product.name}` }).hover();
    await expect(cardImage).toHaveAttribute("src", product.images[1].url);
    await page.mouse.move(0, 0);
    await expect(cardImage).toHaveAttribute("src", product.images[0].url);

    await page.getByRole("button", { name: `View ${product.name}` }).click();
    await expect(page.locator("#shop-product-overlay")).toHaveAttribute("aria-hidden", "false");
    await expect(page.locator("#shop-product-description p")).toHaveCount(2);
    await expect(page.locator("#shop-product-description strong")).toHaveText("front and back");
    await expect(page.locator("#shop-product-information li")).toHaveText("Hang dry");
    await expect(page.locator("#shop-product-image")).toHaveAttribute("src", product.images[0].url);
    await page.getByRole("button", { name: "View image 2 of 2" }).click();
    await expect(page.locator("#shop-product-image")).toHaveAttribute("src", product.images[1].url);
    await page.locator("#shop-product-variants select").selectOption("variant-l");
    await expect(page.locator("#shop-product-price")).toHaveText("$28.00");
    await page.locator("#shop-add-to-cart").click();
    await expect(page.locator("#shop-cart-count")).toHaveText("1");
    await page.locator("#shop-product-close").click();

    await page.locator("#shop-cart-open").click();
    await expect(page.locator("#shop-cart-overlay")).toHaveAttribute("aria-hidden", "false");
    await expect(page.locator("#shop-cart-items")).toContainText(product.name);
    await page.getByRole("button", { name: `Increase ${product.name} quantity` }).click();
    await expect(page.locator("#shop-cart-items")).toContainText("2");
    await expect(page.locator("#shop-cart-subtotal")).toHaveText("$56.00");

    await page.locator("#shop-checkout").click();
    await expect(page).toHaveURL(/shop\.example\.com\/checkout\/?\?cartCurrency=USD&cartId=cart-1/);
    await expect(page).toHaveTitle("Fourthwall checkout");
  });

  test("opens the mixes list directly from its section route", async ({ page }) => {
    await page.goto("/?view=mixes");
    await expect(page.locator("#landing")).toBeHidden();
    await expect(page.locator("#booklet")).toBeVisible();
    await expect(page.locator("#mixes-nav-link")).toHaveAttribute("aria-current", "page");
    await page.locator("#shop-nav-link").click();
    await expect(page).toHaveURL(/\/shop\/$/);
    await expect(page.locator("#shop-app")).toBeVisible();
  });

  test("keeps single-image products simple and strips unsafe rich text", async ({ page }) => {
    await page.route("https://storefront-api.fourthwall.com/**", async (route) => {
      const singleImageProduct = {
        ...product,
        images: product.images.slice(0, 1),
        description:
          '<p>Safe <a href="javascript:alert(1)">link</a></p><script>window.insecure = true</script>',
      };
      await route.fulfill({
        json: { results: [singleImageProduct], paging: { hasNextPage: false } },
      });
    });

    await page.goto("/shop/");
    await page.getByRole("button", { name: `View ${product.name}` }).click();
    await expect(page.locator("#shop-product-gallery")).toBeHidden();
    await expect(page.locator("#shop-product-description a")).not.toHaveAttribute("href");
    await expect(page.locator("#shop-product-description")).not.toContainText("window.insecure");
  });

  test("defaults currency from browser region and persists a manual override", async ({
    browser,
  }) => {
    const context = await browser.newContext({ locale: "en-GB" });
    const page = await context.newPage();
    const requestedCurrencies: string[] = [];

    await page.route("https://storefront-api.fourthwall.com/**", async (route) => {
      const url = new URL(route.request().url());
      const currency = url.searchParams.get("currency") || "";
      requestedCurrencies.push(currency);

      if (url.pathname === "/v1/collections/all/products") {
        const localizedProduct = structuredClone(product);
        localizedProduct.variants = localizedProduct.variants.map((variant) => ({
          ...variant,
          unitPrice: { ...variant.unitPrice, currency },
        }));
        await route.fulfill({
          json: { results: [localizedProduct], paging: { hasNextPage: false } },
        });
        return;
      }

      await route.fulfill({ status: 404, json: { code: "NOT_FOUND" } });
    });

    await page.goto("/shop/");
    await expect(page.locator("#shop-product-count")).toHaveText("1 Item");
    await expect(page.locator("#shop-currency")).toHaveValue("GBP");
    await expect(page.locator("#shop-products-list article")).toContainText("£24.00");
    expect(requestedCurrencies).toEqual(["GBP"]);

    await page.locator("#shop-currency").selectOption("USD");
    await expect(page.locator("#shop-currency")).toHaveValue("USD");
    await expect(page.locator("#shop-products-list article")).toContainText("$24.00");
    expect(requestedCurrencies).toEqual(["GBP", "USD"]);

    await page.reload();
    await expect(page.locator("#shop-product-count")).toHaveText("1 Item");
    await expect(page.locator("#shop-currency")).toHaveValue("USD");
    expect(requestedCurrencies).toEqual(["GBP", "USD", "USD"]);
    await context.close();
  });
});
