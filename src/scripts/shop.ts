import {
  createFourthwallClient,
  getCurrencyFromLocales,
  formatFourthwallMoney,
  isFourthwallCurrency,
  type FourthwallBundle,
  type FourthwallCart,
  type FourthwallCartRequestItem,
  type FourthwallOffer,
  type FourthwallProduct,
  type FourthwallVariant,
} from "../services/fourthwall";

const CART_STORAGE_KEY = "invigilators-fourthwall-cart";
const CURRENCY_STORAGE_KEY = "invigilators-fourthwall-currency";

const text = (parent: ParentNode, selector: string) => parent.querySelector<HTMLElement>(selector);

const isBundle = (offer: FourthwallOffer): offer is FourthwallBundle => offer.type === "BUNDLE";

const offerImage = (offer: FourthwallOffer) =>
  offer.images[0]?.transformedUrl || offer.images[0]?.url || "";

const availability = (variant: FourthwallVariant) => {
  if (variant.stock.type === "UNLIMITED") return true;
  return (variant.stock.inStock ?? 0) > 0;
};

const richTextTags = new Set([
  "P",
  "BR",
  "STRONG",
  "B",
  "EM",
  "I",
  "UL",
  "OL",
  "LI",
  "A",
  "H2",
  "H3",
  "H4",
  "BLOCKQUOTE",
]);

const renderRichText = (container: HTMLElement, html: string) => {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const copy = (source: Node, destination: Node) => {
    if (source.nodeType === Node.TEXT_NODE) {
      destination.appendChild(document.createTextNode(source.textContent || ""));
      return;
    }
    if (!(source instanceof Element) || ["SCRIPT", "STYLE", "IFRAME"].includes(source.tagName))
      return;
    const element = richTextTags.has(source.tagName)
      ? document.createElement(source.tagName.toLowerCase())
      : null;
    if (element?.tagName === "A") {
      const href = source.getAttribute("href");
      if (href) {
        try {
          const url = new URL(href, window.location.href);
          if (["https:", "http:", "mailto:"].includes(url.protocol))
            element.setAttribute("href", url.href);
        } catch {
          // Ignore malformed links in storefront content.
        }
      }
    }
    const target = element ?? destination;
    for (const child of source.childNodes) copy(child, target);
    if (element) destination.appendChild(element);
  };
  const fragment = document.createDocumentFragment();
  for (const child of parsed.body.childNodes) copy(child, fragment);
  container.replaceChildren(fragment);
};

export const initShop = () => {
  const root = document.getElementById("shop-app");
  const overlay = document.getElementById("shop-product-overlay");
  const cartOverlay = document.getElementById("shop-cart-overlay");
  if (!root || !overlay || !cartOverlay) return;

  const token = root.dataset.storefrontToken || "";
  const apiUrl = root.dataset.apiUrl || "https://storefront-api.fourthwall.com";
  const shopDomain = root.dataset.shopDomain || "";
  const status = text(root, "#shop-status");
  const productList = text(root, "#shop-products-list");
  const productCount = text(root, "#shop-product-count");
  const productImage = text(overlay, "#shop-product-image") as HTMLImageElement | null;
  const productGallery = text(overlay, "#shop-product-gallery");
  const productTitle = text(overlay, "#shop-product-title");
  const productPrice = text(overlay, "#shop-product-price");
  const productDescription = text(overlay, "#shop-product-description");
  const productVariants = text(overlay, "#shop-product-variants");
  const productAvailability = text(overlay, "#shop-product-availability");
  const productInformation = text(overlay, "#shop-product-information");
  const addButton = text(overlay, "#shop-add-to-cart") as HTMLButtonElement | null;
  const cartItems = text(cartOverlay, "#shop-cart-items");
  const cartSubtotal = text(cartOverlay, "#shop-cart-subtotal");
  const cartStatus = text(cartOverlay, "#shop-cart-status");
  const cartCount = text(root, "#shop-cart-count");
  const currencySelect = root.querySelector<HTMLSelectElement>("#shop-currency");
  const checkoutButton = text(cartOverlay, "#shop-checkout") as HTMLButtonElement | null;
  const overlayCounter = text(overlay, "#shop-overlay-counter");
  const overlayNavTitle = text(overlay, "#shop-overlay-nav-title");

  if (
    !status ||
    !productList ||
    !productImage ||
    !productGallery ||
    !productTitle ||
    !productPrice ||
    !productDescription ||
    !productVariants ||
    !productAvailability ||
    !productInformation ||
    !addButton ||
    !cartItems ||
    !cartSubtotal ||
    !cartStatus ||
    !cartCount ||
    !currencySelect ||
    !checkoutButton ||
    !overlayCounter ||
    !overlayNavTitle
  ) {
    return;
  }

  const storedCurrency = window.localStorage.getItem(CURRENCY_STORAGE_KEY);
  let selectedCurrency =
    storedCurrency && isFourthwallCurrency(storedCurrency)
      ? storedCurrency
      : getCurrencyFromLocales(
          navigator.languages.length ? navigator.languages : [navigator.language]
        );
  currencySelect.value = selectedCurrency;
  currencySelect.addEventListener("change", () => {
    if (!isFourthwallCurrency(currencySelect.value)) return;
    selectedCurrency = currencySelect.value;
    window.localStorage.setItem(CURRENCY_STORAGE_KEY, selectedCurrency);
    window.location.reload();
  });

  if (!token) {
    status.textContent = "The shop is not connected yet. Configure its Storefront API token.";
    return;
  }

  const client = createFourthwallClient({ token, apiUrl });
  const products = new Map<string, FourthwallOffer>();
  let cart: FourthwallCart | null = null;
  let activeOffer: FourthwallOffer | null = null;
  let cartBusy = false;
  let hasProductHistoryEntry = false;

  const updateCartIndicator = () => {
    const count = cart?.items.reduce((total, item) => total + item.quantity, 0) ?? 0;
    cartCount.textContent = String(count);
    cartCount.setAttribute("aria-label", `${count} items`);
  };

  const setOverlayOpen = (element: HTMLElement, isOpen: boolean) => {
    element.classList.toggle("hidden", !isOpen);
    element.setAttribute("aria-hidden", String(!isOpen));
    document.body.classList.toggle("overlay-open", isOpen);
    if (isOpen) {
      window.requestAnimationFrame(() => element.classList.add("is-open"));
    } else {
      element.classList.remove("is-open");
    }
  };

  const appendProductCard = (offer: FourthwallOffer, index: number) => {
    const card = document.createElement("article");
    card.className = "group min-w-0 border border-(--border) bg-(--card)";

    const imageButton = document.createElement("button");
    imageButton.className =
      "shop-product-open block aspect-square w-full cursor-pointer overflow-hidden border-0 bg-[#0a0104] p-0 text-left";
    imageButton.type = "button";
    imageButton.dataset.productSlug = offer.slug;
    imageButton.setAttribute("aria-label", `View ${offer.name}`);
    const image = document.createElement("img");
    image.className =
      "h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.035]";
    image.src = offerImage(offer);
    image.alt = offer.name;
    image.loading = index < 4 ? "eager" : "lazy";
    if (offer.images[1]) {
      imageButton.addEventListener("mouseenter", () => {
        image.src = offer.images[1].transformedUrl || offer.images[1].url;
      });
      imageButton.addEventListener("mouseleave", () => {
        image.src = offerImage(offer);
      });
      imageButton.addEventListener("focus", () => {
        image.src = offer.images[1].transformedUrl || offer.images[1].url;
      });
      imageButton.addEventListener("blur", () => {
        image.src = offerImage(offer);
      });
    }
    imageButton.append(image);

    const info = document.createElement("div");
    info.className = "flex min-h-24 items-start justify-between gap-3 p-4";
    const title = document.createElement("div");
    const name = document.createElement("h2");
    name.className = "mb-2 text-xs font-semibold leading-relaxed text-(--foreground)";
    name.textContent = offer.name;
    const price = document.createElement("p");
    price.className = "font-mono text-[10px] text-(--muted-foreground)";
    price.textContent = formatFourthwallMoney(
      isBundle(offer)
        ? offer.price
        : (offer.variants[0]?.unitPrice ?? { value: 0, currency: "USD" })
    );
    title.append(name, price);

    const detailButton = document.createElement("button");
    detailButton.className =
      "shop-product-open mt-0.5 shrink-0 cursor-pointer border border-(--border) bg-transparent px-2.5 py-1.5 font-mono text-[8px] uppercase tracking-[0.08em] text-(--foreground) transition-colors hover:border-(--accent)";
    detailButton.type = "button";
    detailButton.dataset.productSlug = offer.slug;
    detailButton.textContent = "Details";
    info.append(title, detailButton);
    card.append(imageButton, info);
    productList.append(card);
  };

  const getSelectedCartItems = (): FourthwallCartRequestItem[] => {
    if (!activeOffer) return [];
    if (!isBundle(activeOffer)) {
      const selected = productVariants.querySelector<HTMLSelectElement>("select[name='variant']");
      return selected?.value ? [{ variantId: selected.value, quantity: 1 }] : [];
    }

    return activeOffer.offers.flatMap((product) => {
      const selected = productVariants.querySelector<HTMLSelectElement>(
        `select[data-bundle-offer="${CSS.escape(product.id)}"]`
      );
      return selected?.value
        ? [{ variantId: selected.value, quantity: 1, bundleId: activeOffer?.id }]
        : [];
    });
  };

  const updateProductPrice = () => {
    if (!activeOffer) return;
    if (isBundle(activeOffer)) {
      productPrice.textContent = formatFourthwallMoney(activeOffer.price);
      return;
    }
    const selectedId =
      productVariants.querySelector<HTMLSelectElement>("select[name='variant']")?.value;
    const selectedVariant = activeOffer.variants.find((variant) => variant.id === selectedId);
    if (selectedVariant)
      productPrice.textContent = formatFourthwallMoney(selectedVariant.unitPrice);
  };

  const openProduct = (offer: FourthwallOffer, updateHistory: boolean) => {
    activeOffer = offer;
    productTitle.textContent = offer.name;
    renderRichText(productDescription, offer.description);
    productGallery.replaceChildren();
    const galleryButtons: HTMLButtonElement[] = [];
    const selectImage = (index: number) => {
      const image = offer.images[index];
      productImage.src = image?.transformedUrl || image?.url || "";
      productImage.alt = offer.images.length
        ? `${offer.name}, image ${index + 1} of ${offer.images.length}`
        : offer.name;
      galleryButtons.forEach((button, buttonIndex) => {
        button.setAttribute("aria-pressed", String(buttonIndex === index));
        button.classList.toggle("border-(--accent)", buttonIndex === index);
        button.classList.toggle("border-(--border)", buttonIndex !== index);
      });
    };
    offer.images.forEach((image, index) => {
      if (offer.images.length < 2) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className =
        "size-16 shrink-0 cursor-pointer overflow-hidden border bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-(--accent)";
      button.setAttribute("aria-label", `View image ${index + 1} of ${offer.images.length}`);
      const thumbnail = document.createElement("img");
      thumbnail.src = image.transformedUrl || image.url;
      thumbnail.alt = "";
      thumbnail.className = "size-full object-cover";
      button.append(thumbnail);
      button.addEventListener("click", () => selectImage(index));
      galleryButtons.push(button);
      productGallery.append(button);
    });
    productGallery.classList.toggle("hidden", offer.images.length < 2);
    selectImage(0);
    productVariants.replaceChildren();
    productInformation.replaceChildren();
    overlayNavTitle.textContent = offer.name;
    overlayCounter.textContent = `${Array.from(products.keys()).indexOf(offer.slug) + 1} / ${products.size}`;

    const productSets = isBundle(offer) ? offer.offers : [offer];
    for (const [setIndex, product] of productSets.entries()) {
      const label = document.createElement("label");
      label.className =
        "flex flex-col gap-2 font-mono text-[9px] uppercase tracking-[0.1em] text-(--muted-foreground)";
      label.textContent = isBundle(offer) ? product.name : "Select option";
      const select = document.createElement("select");
      select.className =
        "w-full border border-(--border) bg-[#150306] px-3 py-3 text-xs normal-case tracking-normal text-(--foreground) focus-visible:border-(--accent) focus-visible:outline-none";
      select.dataset.bundleOffer = isBundle(offer) ? product.id : "";
      select.name = isBundle(offer) ? `bundle-${product.id}` : "variant";

      for (const variant of product.variants) {
        const option = document.createElement("option");
        option.value = variant.id;
        option.textContent = `${variant.attributes?.description || variant.name} · ${formatFourthwallMoney(variant.unitPrice)}`;
        option.disabled = !availability(variant);
        select.append(option);
      }

      if (!product.variants.some(availability)) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "Sold out";
        option.selected = true;
        select.prepend(option);
      }
      select.disabled = !product.variants.some(availability);
      select.addEventListener("change", updateProductPrice);
      label.append(select);
      productVariants.append(label);
      if (setIndex === 0 && !isBundle(offer)) {
        productAvailability.textContent = product.variants.some(availability)
          ? "In stock or made to order"
          : "Currently unavailable";
      }
    }

    if (isBundle(offer)) {
      productAvailability.textContent =
        offer.state.type === "SOLD_OUT" ? "Currently unavailable" : "Bundle";
    }
    addButton.disabled =
      offer.state.type === "SOLD_OUT" ||
      !productSets.every((product) => product.variants.some(availability));
    updateProductPrice();

    for (const info of offer.additionalInformation ?? []) {
      const section = document.createElement("section");
      section.className = "border-t border-(--border) pt-4";
      const heading = document.createElement("h2");
      heading.className =
        "mb-2 font-mono text-[9px] uppercase tracking-[0.12em] text-(--foreground)";
      heading.textContent = info.title;
      const body = document.createElement("div");
      body.className = "shop-rich-text text-[11px] leading-relaxed text-(--muted-foreground)";
      renderRichText(body, info.bodyHtml);
      section.append(heading, body);
      productInformation.append(section);
    }

    if (!isBundle(offer) && offer.sizeGuide) {
      const guide = document.createElement("section");
      guide.className = "border-t border-(--border) pt-4";
      const heading = document.createElement("h2");
      heading.className =
        "mb-2 font-mono text-[9px] uppercase tracking-[0.12em] text-(--foreground)";
      heading.textContent = "Size guide";
      const body = document.createElement("p");
      body.className = "text-[11px] leading-relaxed text-(--muted-foreground)";
      body.textContent = offer.sizeGuide.description || offer.sizeGuide.fitGuideDescription || "";
      guide.append(heading, body);
      if (offer.sizeGuide.previewUrl || offer.sizeGuide.fileUrl) {
        const link = document.createElement("a");
        link.className =
          "mt-2 inline-block text-[11px] text-(--foreground) underline underline-offset-4";
        link.href = offer.sizeGuide.previewUrl || offer.sizeGuide.fileUrl || "";
        link.target = "_blank";
        link.rel = "noreferrer";
        link.textContent = "View size guide";
        guide.append(link);
      }
      productInformation.append(guide);
    }

    setOverlayOpen(overlay, true);
    if (updateHistory) {
      const url = new URL(window.location.href);
      url.searchParams.set("product", offer.slug);
      window.history.pushState({ productSlug: offer.slug }, offer.name, url);
      hasProductHistoryEntry = true;
    }
    text(overlay, "#shop-product-close")?.focus();
  };

  const closeProduct = (updateHistory: boolean) => {
    setOverlayOpen(overlay, false);
    if (updateHistory && new URL(window.location.href).searchParams.has("product")) {
      if (hasProductHistoryEntry) {
        hasProductHistoryEntry = false;
        window.history.back();
      } else {
        window.history.replaceState({}, "Shop | The Invigilators", "/shop/");
      }
    }
    text(root, ".shop-product-open")?.focus();
  };

  const renderCart = () => {
    cartItems.replaceChildren();
    const items = cart?.items ?? [];
    let subtotal = 0;
    let currency = selectedCurrency;

    for (const item of items) {
      const row = document.createElement("article");
      row.className =
        "grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-4 border-b border-(--border) py-4";
      const image = document.createElement("img");
      image.className = "size-16 object-cover";
      image.src = item.variant.images[0]?.transformedUrl || item.variant.images[0]?.url || "";
      image.alt = "";
      const details = document.createElement("div");
      const name = document.createElement("p");
      name.className = "mb-1 text-xs font-semibold";
      name.textContent = item.variant.product.name;
      const variantName = document.createElement("p");
      variantName.className = "mb-2 text-[10px] text-(--muted-foreground)";
      variantName.textContent = item.variant.attributes?.description || item.variant.name;
      const controls = document.createElement("div");
      controls.className = "flex items-center gap-2 font-mono text-[10px]";
      const decrease = document.createElement("button");
      decrease.className =
        "grid size-6 cursor-pointer place-items-center border border-(--border) bg-transparent text-(--foreground) hover:border-(--accent) disabled:opacity-40";
      decrease.type = "button";
      decrease.dataset.cartAction = "quantity";
      decrease.dataset.variantId = item.variant.id;
      decrease.dataset.quantity = String(Math.max(0, item.quantity - 1));
      decrease.textContent = "-";
      decrease.setAttribute("aria-label", `Decrease ${item.variant.product.name} quantity`);
      decrease.disabled = item.quantity <= 1;
      const quantity = document.createElement("span");
      quantity.className = "min-w-5 text-center tabular-nums";
      quantity.textContent = String(item.quantity);
      const increase = document.createElement("button");
      increase.className =
        "grid size-6 cursor-pointer place-items-center border border-(--border) bg-transparent text-(--foreground) hover:border-(--accent)";
      increase.type = "button";
      increase.dataset.cartAction = "quantity";
      increase.dataset.variantId = item.variant.id;
      increase.dataset.quantity = String(item.quantity + 1);
      increase.textContent = "+";
      increase.setAttribute("aria-label", `Increase ${item.variant.product.name} quantity`);
      const remove = document.createElement("button");
      remove.className =
        "cursor-pointer border-0 bg-transparent p-1 text-(--muted-foreground) underline underline-offset-2 hover:text-(--accent)";
      remove.type = "button";
      remove.dataset.cartAction = "remove";
      remove.dataset.variantId = item.variant.id;
      remove.textContent = "Remove";
      controls.append(decrease, quantity, increase, remove);
      details.append(name, variantName, controls);

      const price = document.createElement("span");
      price.className = "font-mono text-[10px]";
      price.textContent = formatFourthwallMoney(item.variant.unitPrice);
      currency = item.variant.unitPrice.currency;
      subtotal += item.variant.unitPrice.value * item.quantity;
      row.append(image, details, price);
      cartItems.append(row);
    }

    if (items.length === 0) {
      const empty = document.createElement("p");
      empty.className = "py-10 text-center font-mono text-xs text-(--muted-foreground)";
      empty.textContent = "Your cart is empty.";
      cartItems.append(empty);
    }

    cartSubtotal.textContent = formatFourthwallMoney({ value: subtotal, currency });
    checkoutButton.disabled = items.length === 0 || cartBusy || !shopDomain;
    if (!shopDomain)
      cartStatus.textContent = "Checkout is unavailable until the shop domain is configured.";
    updateCartIndicator();
  };

  const ensureCart = async () => {
    if (cart) return cart;
    const savedCartId = window.localStorage.getItem(CART_STORAGE_KEY);
    if (savedCartId) {
      try {
        cart = await client.getCart(savedCartId, selectedCurrency);
        return cart;
      } catch {
        window.localStorage.removeItem(CART_STORAGE_KEY);
      }
    }
    return null;
  };

  const refreshCart = async () => {
    const savedCartId = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!savedCartId) {
      cart = null;
      renderCart();
      return;
    }
    try {
      cart = await client.getCart(savedCartId, selectedCurrency);
    } catch {
      cart = null;
      window.localStorage.removeItem(CART_STORAGE_KEY);
      cartStatus.textContent = "Your previous cart expired. Start a new cart.";
    }
    renderCart();
  };

  const withCartRequest = async (action: () => Promise<FourthwallCart>, successMessage: string) => {
    if (cartBusy) return;
    cartBusy = true;
    addButton.disabled = true;
    checkoutButton.disabled = true;
    cartStatus.textContent = "Updating your cart...";
    try {
      cart = await action();
      window.localStorage.setItem(CART_STORAGE_KEY, cart.id);
      cartStatus.textContent = successMessage;
    } catch (error) {
      cartStatus.textContent =
        error instanceof Error ? error.message : "Unable to update the cart.";
    } finally {
      cartBusy = false;
      addButton.disabled = !activeOffer || activeOffer.state.type === "SOLD_OUT";
      renderCart();
    }
  };

  const loadProducts = async () => {
    status.textContent = "Connecting to the shop...";
    try {
      const offers = await client.getAllProducts(selectedCurrency);
      for (const offer of offers) products.set(offer.slug, offer);
      productList.replaceChildren();
      offers.forEach(appendProductCard);
      productCount.textContent = `${offers.length} ${offers.length === 1 ? "Item" : "Items"}`;
      status.classList.toggle("hidden", offers.length > 0);
      if (offers.length === 0) status.textContent = "There are no products available right now.";

      const requestedSlug = new URL(window.location.href).searchParams.get("product");
      const requestedProduct = requestedSlug ? products.get(requestedSlug) : undefined;
      if (requestedProduct) openProduct(requestedProduct, false);
    } catch (error) {
      status.textContent =
        error instanceof Error ? error.message : "Unable to connect to the shop.";
      status.classList.remove("hidden");
    }
  };

  productList.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>(
      "[data-product-slug]"
    );
    if (!button) return;
    const offer = products.get(button.dataset.productSlug || "");
    if (offer) openProduct(offer, true);
  });

  addButton.addEventListener("click", async () => {
    const items = getSelectedCartItems();
    if (!activeOffer || items.length === 0) return;
    await withCartRequest(async () => {
      const existingCart = await ensureCart();
      return existingCart
        ? client.addToCart(existingCart.id, items, selectedCurrency)
        : client.createCart(items, selectedCurrency);
    }, `${activeOffer.name} added to cart.`);
  });

  text(root, "#shop-cart-open")?.addEventListener("click", async () => {
    cartStatus.textContent = "";
    setOverlayOpen(cartOverlay, true);
    text(cartOverlay, "#shop-cart-close")?.focus();
    await refreshCart();
  });

  cartItems.addEventListener("click", async (event) => {
    const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>(
      "[data-cart-action]"
    );
    const variantId = button?.dataset.variantId;
    if (!cart || !variantId) return;
    const item = cart.items.find((cartItem) => cartItem.variant.id === variantId);
    if (!item) return;
    if (button.dataset.cartAction === "quantity") {
      const quantity = Number(button.dataset.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) return;
      await withCartRequest(
        () => client.changeCart(cart?.id || "", [{ variantId, quantity }], selectedCurrency),
        "Cart quantity updated."
      );
      return;
    }
    await withCartRequest(
      () =>
        client.removeFromCart(
          cart?.id || "",
          [{ variantId, quantity: item.quantity }],
          selectedCurrency
        ),
      "Item removed from cart."
    );
  });

  checkoutButton.addEventListener("click", () => {
    if (!cart || !shopDomain || cart.items.length === 0) return;
    const params = new URLSearchParams({ cartCurrency: selectedCurrency, cartId: cart.id });
    window.location.assign(`https://${shopDomain}/checkout/?${params.toString()}`);
  });

  text(overlay, "#shop-product-close")?.addEventListener("click", () => closeProduct(true));
  text(cartOverlay, "#shop-cart-close")?.addEventListener("click", () =>
    setOverlayOpen(cartOverlay, false)
  );
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeProduct(true);
  });
  cartOverlay.addEventListener("click", (event) => {
    if (event.target === cartOverlay) setOverlayOpen(cartOverlay, false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (overlay.classList.contains("is-open")) closeProduct(true);
    if (cartOverlay.classList.contains("is-open")) setOverlayOpen(cartOverlay, false);
  });
  window.addEventListener("popstate", () => {
    const slug = new URL(window.location.href).searchParams.get("product");
    const offer = slug ? products.get(slug) : undefined;
    if (offer) openProduct(offer, false);
    else setOverlayOpen(overlay, false);
  });

  void refreshCart();
  void loadProducts();
};
