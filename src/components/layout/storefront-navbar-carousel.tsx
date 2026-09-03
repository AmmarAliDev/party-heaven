"use client";

import {
    type PointerEvent as ReactPointerEvent,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import Image from "next/image";
import Link from "next/link";
import Autoplay from "embla-carousel-autoplay";
import useEmblaCarousel from "embla-carousel-react";
import {
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    LayoutGrid,
    LoaderCircle,
} from "lucide-react";

import { formatPrice } from "@/lib/currency";
import { cn } from "@/lib/utils";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
    NAVBAR_CATEGORY_DROPDOWN_PRODUCT_LIMIT,
    type StorefrontNavbarCategory,
} from "./storefront-navbar-categories";

type EmblaApi = NonNullable<ReturnType<typeof useEmblaCarousel>[1]>;

/**
 * Carousel options: start-aligned snaps that trim trailing space when fewer
 * categories exist than can be shown, snapping (no free-drag) so a category
 * pill is never left half-visible.
 */
export const NAVBAR_CATEGORY_CAROUSEL_OPTIONS = {
    align: "start",
    containScroll: "trimSnaps",
    loop: true
} as const;

/**
 * Responsive per-slide sizing. Mobile shows exactly five pills per view; from
 * the `md` breakpoint the pills use their natural (auto) width so every
 * category that fits is visible and the arrows only appear on overflow.
 * `min-w-0` lets a slide shrink to its fixed mobile basis so a fifth of the
 * viewport really holds five pills (text truncates inside the cell).
 */
export const NAVBAR_CATEGORY_ITEM_CLASS =
    "min-w-0 shrink-0 grow-0 basis-1/4 sm:basis-1/5 px-0.5 md:basis-auto md:px-1";

/** Delay between auto-slide advances (ms). */
const NAVBAR_CATEGORY_AUTOPLAY_DELAY = 2000;

/** Small, fast thumbnails: the category art is only ever shown in a circle. */
const NAVBAR_CATEGORY_IMAGE_DIMENSION = 80;

const arrowButtonClassName =
    "hidden size-8 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-40";

type CategoryPill = Extract<StorefrontNavbarCategory, { kind: "category" }>;

type NavbarCategoryProduct = {
    name: string;
    href: string;
    price: number;
    imageUrl?: string;
    imageTone: string;
};

type NavbarCategoryProductsResponse = {
    products: NavbarCategoryProduct[];
    total: number;
};

// Lazy, memoized product fetches for the category dropdowns. The dropdown
// body mounts on every open, so a per-slug promise cache (with a TTL) avoids
// hammering the products API while the visitor browses the navbar.
const NAVBAR_PRODUCT_CACHE_TTL_MS = 5 * 60 * 1000;
const navbarProductCache = new Map<
    string,
    { createdAt: number; promise: Promise<NavbarCategoryProductsResponse> }
>();

/** Test helper — clears the in-memory navbar product dropdown cache. */
export function __resetNavbarCategoryProductsCacheForTests() {
    navbarProductCache.clear();
}

async function fetchNavbarCategoryProducts(
    slug: string,
): Promise<NavbarCategoryProductsResponse> {
    const response = await fetch(
        `/api/catalog/categories/${encodeURIComponent(slug)}/products?pageSize=${NAVBAR_CATEGORY_DROPDOWN_PRODUCT_LIMIT}`,
    );
    if (!response.ok) {
        throw new Error(`Failed to load category products (${response.status})`);
    }

    const payload = (await response.json()) as {
        products?: Array<{
            name: string;
            href: string;
            price: number;
            imageUrl?: string;
            imageTone?: string;
        }>;
        pagination?: { totalItems?: number };
    };

    const products = (payload.products ?? []).map((product) => ({
        name: product.name,
        href: product.href,
        price: product.price,
        ...(product.imageUrl ? { imageUrl: product.imageUrl } : {}),
        imageTone: product.imageTone ?? "slate",
    }));

    return {
        products,
        total: payload.pagination?.totalItems ?? products.length,
    };
}

function getNavbarCategoryProducts(
    slug: string,
): Promise<NavbarCategoryProductsResponse> {
    const cached = navbarProductCache.get(slug);
    if (cached && Date.now() - cached.createdAt < NAVBAR_PRODUCT_CACHE_TTL_MS) {
        return cached.promise;
    }

    const promise = fetchNavbarCategoryProducts(slug).catch((error) => {
        navbarProductCache.delete(slug);
        throw error;
    });

    navbarProductCache.set(slug, { createdAt: Date.now(), promise });
    return promise;
}

type DropdownController = {
    open: boolean;
    isDragging: () => boolean;
    onRequestOpen: () => void;
    onScheduleClose: () => void;
    onCancelClose: () => void;
    onClose: () => void;
};

function CategoryCircleLink({ item }: { item: CategoryPill }) {
    return (
        <Link
            href={item.href}
            aria-label={`Browse ${item.title}`}
            className="focus-visible:ring-ring flex size-14 items-center justify-center rounded-full transition-transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 group-hover:scale-105 sm:size-16 md:size-16 lg:size-20"
        >
            <span className="border-border/70 bg-muted flex size-full items-center justify-center overflow-hidden rounded-full border">
                {item.cardImageUrl ? (
                    <Image
                        src={item.cardImageUrl}
                        alt=""
                        width={NAVBAR_CATEGORY_IMAGE_DIMENSION}
                        height={NAVBAR_CATEGORY_IMAGE_DIMENSION}
                        sizes="(min-width: 1024px) 140px, (min-width: 768px) 64px, (min-width: 640px) 56px, 48px"
                        className="h-full w-full object-cover"
                        loading="lazy"
                    />
                ) : (
                    <span
                        aria-hidden="true"
                        className="text-foreground/70 flex items-center justify-center text-lg font-semibold uppercase"
                    >
                        {item.title.charAt(0)}
                    </span>
                )}
            </span>
        </Link>
    );
}

function CategoryDropdownTrigger({
    item,
    controller,
}: {
    item: CategoryPill;
    controller: DropdownController;
}) {
    return (
        <DropdownMenu
            open={controller.open}
            modal={false}
            onOpenChange={(next) => {
                if (next) {
                    controller.onRequestOpen();
                } else {
                    controller.onClose();
                }
            }}
        >
            <DropdownMenuTrigger
                onPointerDown={(event) => {
                    // Suppress Radix's own pointer-down toggle: opening is handled on
                    // click below (drag-safe), and this way clicking a title that was
                    // already opened by hover never closes it.
                    if (event.button !== 0 || event.ctrlKey || controller.isDragging()) {
                        return;
                    }
                    event.preventDefault();
                }}
                onClick={() => {
                    if (!controller.isDragging()) {
                        controller.onRequestOpen();
                    }
                }}
                onMouseEnter={() => {
                    if (!controller.isDragging()) {
                        controller.onRequestOpen();
                    }
                }}
                onMouseLeave={() => controller.onScheduleClose()}
                title={item.title}
                aria-label={`Products in ${item.title}`}
                className="text-muted-foreground cursor-pointer hover:text-foreground inline-flex min-w-0 max-w-full items-center gap-0.5 rounded-full px-1.5 py-1 text-xs font-medium transition-colors focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 md:max-w-none md:text-[13px]"
            >
                <span className="min-w-0 truncate md:overflow-visible">{item.title}</span>
                <ChevronDown
                    aria-hidden="true"
                    className={cn(
                        "size-3 shrink-0 transition-transform duration-200",
                        controller.open && "rotate-180",
                    )}
                />
            </DropdownMenuTrigger>

            <DropdownMenuContent
                align="center"
                sideOffset={6}
                // Hover-driven popovers: a closing neighbour menu must not yank focus
                // back to its trigger — that focus hand-off makes Radix's non-modal
                // menus auto-close each other (onOpenChange(false)) the moment a new
                // one opens while the pointer moves between titles.
                onCloseAutoFocus={(event) => event.preventDefault()}
                onMouseEnter={() => controller.onCancelClose()}
                onMouseLeave={() => controller.onScheduleClose()}
                // Wide centred panel on mobile; fixed-width card on md+.
                className="w-[80vw] p-1.5 md:w-max"
            >
                <NavbarCategoryProducts item={item} />
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function CategoryNavItem({
    item,
    controller,
}: {
    item: StorefrontNavbarCategory;
    controller: DropdownController;
}) {
    return (
        <li className={cn("group", NAVBAR_CATEGORY_ITEM_CLASS)}>
            <div className="flex w-full flex-col items-center gap-1.5 py-1 md:w-auto">
                <CategoryCircleLink item={item} />
                <CategoryDropdownTrigger item={item} controller={controller} />
            </div>
        </li>
    );
}

function ProductThumbnail({ product }: { product: NavbarCategoryProduct }) {
    if (product.imageUrl) {
        return (
            <span className="border-border/60 bg-muted relative size-9 shrink-0 overflow-hidden rounded-md border">
                <Image
                    src={product.imageUrl}
                    alt=""
                    width={40}
                    height={40}
                    sizes="36px"
                    className="h-full w-full object-cover"
                    loading="lazy"
                />
            </span>
        );
    }

    return (
        <span
            aria-hidden="true"
            className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-md border border-border/60 text-sm font-semibold uppercase"
        >
            {product.name.charAt(0)}
        </span>
    );
}

function NavbarCategoryProducts({ item }: { item: CategoryPill }) {
    const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
    const [products, setProducts] = useState<NavbarCategoryProduct[]>([]);
    const [total, setTotal] = useState(item.productCount);

    // The content mounts fresh per open (and per category, via the slide key),
    // so the initial "loading" state is correct and only the async result is
    // applied here.
    useEffect(() => {
        let active = true;

        getNavbarCategoryProducts(item.slug)
            .then((result) => {
                if (!active) return;
                setProducts(result.products);
                setTotal(result.total);
                setStatus("ready");
            })
            .catch(() => {
                if (active) setStatus("error");
            });

        return () => {
            active = false;
        };
    }, [item.slug]);

    if (status === "loading") {
        return (
            <div className="text-muted-foreground flex items-center justify-center gap-2 px-2 py-8 text-sm">
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                <span>Loading products…</span>
            </div>
        );
    }

    if (status === "error") {
        return (
            <div className="text-muted-foreground px-3 py-4 text-sm">
                We couldn&apos;t load these products.{" "}
                <Link
                    href={item.href}
                    className="text-primary-strong underline underline-offset-2"
                >
                    Browse {item.title}
                </Link>
            </div>
        );
    }

    if (products.length === 0) {
        return (
            <div className="text-muted-foreground px-3 py-4 text-sm">
                No products in {item.title} yet.
            </div>
        );
    }

    return (
        <div data-testid="navbar-category-products" className="pb-0.5">
            <ul className="grid  gap-0.5 ">
                {products.map((product) => (
                    <li key={product.href}>
                        <DropdownMenuItem asChild className="focus:bg-accent rounded-md">
                            <Link
                                href={product.href}
                                className="flex items-center gap-2.5 px-2 py-1.5 cursor-pointer"
                            >
                                <ProductThumbnail product={product} />
                                <span className="min-w-0 flex-1 truncate text-sm">
                                    {product.name}
                                </span>
                                <span className="text-muted-foreground shrink-0 text-xs">
                                    {formatPrice(product.price)}
                                </span>
                            </Link>
                        </DropdownMenuItem>
                    </li>
                ))}
            </ul>

            {total > products.length ? (
                <>
                    <DropdownMenuSeparator className="my-1" />
                    <DropdownMenuItem asChild className="focus:bg-accent rounded-md">
                        <Link
                            href={item.href}
                            className="text-primary-strong flex items-center justify-center gap-1 px-2 py-2 text-xs font-semibold"
                        >
                            View all {total} products
                        </Link>
                    </DropdownMenuItem>
                </>
            ) : null}
        </div>
    );
}

type StorefrontNavbarCarouselProps = {
    items: StorefrontNavbarCategory[];
};

export function StorefrontNavbarCarousel({
    items,
}: StorefrontNavbarCarouselProps) {
    // Auto-slide pauses whenever the visitor is hovering the row, dragging it,
    // or has a category dropdown open — and only runs while the carousel can
    // actually scroll (more categories than fit the viewport).
    const autoplayPlugin = useMemo(
        () =>
            Autoplay({
                delay: NAVBAR_CATEGORY_AUTOPLAY_DELAY,
                playOnInit: false,
                stopOnInteraction: true,
            }),
        [],
    );

    const [viewportRef, emblaApi] = useEmblaCarousel(
        NAVBAR_CATEGORY_CAROUSEL_OPTIONS,
        [autoplayPlugin],
    );
    const [canScrollPrev, setCanScrollPrev] = useState(false);
    const [canScrollNext, setCanScrollNext] = useState(false);
    const [activeSlug, setActiveSlug] = useState<string | null>(null);
    const [hovering, setHovering] = useState(false);

    // Shared drag detection — hovering a category title while a drag is in
    // progress (or right after one) must never open its product dropdown.
    const dragRef = useRef({ down: false, moved: false, x: 0, y: 0 });
    const closeTimerRef = useRef<number | null>(null);

    const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
    const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

    const isDragging = useCallback(() => dragRef.current.down || dragRef.current.moved, []);

    // Latest-state mirrors so event-driven autoplay decisions never read stale
    // values from an old render closure.
    const activeSlugRef = useRef(activeSlug);
    const hoveringRef = useRef(hovering);
    useEffect(() => {
        activeSlugRef.current = activeSlug;
    }, [activeSlug]);
    useEffect(() => {
        hoveringRef.current = hovering;
    }, [hovering]);

    // Auto-slide only while the carousel can scroll and the visitor is idle
    // (not hovering, not browsing an open dropdown). This is re-evaluated on
    // every embla re-measure/re-init as well as on state changes — embla
    // re-creates the autoplay plugin whenever the slide layout changes (e.g.
    // category images load), which would otherwise leave autoplay stopped.
    const syncAutoplay = useCallback(
        (canScroll: boolean) => {
            if (canScroll && !activeSlugRef.current && !hoveringRef.current) {
                autoplayPlugin.play();
            } else {
                autoplayPlugin.stop();
            }
        },
        [autoplayPlugin],
    );

    useEffect(() => {
        if (!emblaApi) return;

        const updateScrollState = (api: EmblaApi) => {
            setCanScrollPrev(api.canScrollPrev());
            setCanScrollNext(api.canScrollNext());
            syncAutoplay(api.canScrollNext());
        };

        updateScrollState(emblaApi);
        emblaApi.on("select", updateScrollState);
        emblaApi.on("reInit", updateScrollState);
        emblaApi.on("resize", updateScrollState);
        emblaApi.on("slidesChanged", updateScrollState);

        return () => {
            emblaApi.off("select", updateScrollState);
            emblaApi.off("reInit", updateScrollState);
            emblaApi.off("resize", updateScrollState);
            emblaApi.off("slidesChanged", updateScrollState);
        };
    }, [emblaApi, syncAutoplay]);

    // Re-evaluate auto-slide when the idle conditions change.
    useEffect(() => {
        syncAutoplay(canScrollNext);
    }, [canScrollNext, activeSlug, hovering, syncAutoplay]);

    // On small screens the dropdown renders as a wide, horizontally centred
    // panel instead of hugging its (often edge-mounted) trigger. Radix re-runs
    // its own popper positioning whenever it re-measures (which would re-anchor
    // the panel to the trigger), so nudge the portal wrapper back to the
    // horizontal centre for as long as the menu stays open.
    useEffect(() => {
        if (!activeSlug) return;
        if (
            typeof window.matchMedia !== "function" ||
            !window.matchMedia("(max-width: 767.98px)").matches
        ) {
            return;
        }

        let rafId = 0;
        const centreOpenMenu = () => {
            const panel = document.querySelector<HTMLElement>(
                '[role="menu"][data-state="open"]',
            );
            const wrapper = panel?.parentElement;
            if (panel && wrapper) {
                const rect = wrapper.getBoundingClientRect();
                const viewportWidth = window.innerWidth;
                const left = Math.max(8, Math.round((viewportWidth - rect.width) / 2));
                wrapper.style.left = `${left}px`;
                wrapper.style.top = `${Math.max(8, Math.round(rect.top))}px`;
                wrapper.style.transform = "translate(0px, 0px)";
            }
            rafId = window.requestAnimationFrame(centreOpenMenu);
        };

        rafId = window.requestAnimationFrame(centreOpenMenu);
        return () => window.cancelAnimationFrame(rafId);
    }, [activeSlug]);

    useEffect(
        () => () => {
            if (closeTimerRef.current !== null) {
                window.clearTimeout(closeTimerRef.current);
            }
        },
        [],
    );

    const cancelCloseTimer = useCallback(() => {
        if (closeTimerRef.current !== null) {
            window.clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }
    }, []);

    const openCategory = useCallback((slug: string) => {
        cancelCloseTimer();
        setActiveSlug(slug);
    }, [cancelCloseTimer]);

    const closeCategory = useCallback((slug: string) => {
        cancelCloseTimer();
        setActiveSlug((current) => (current === slug ? null : current));
    }, [cancelCloseTimer]);

    const scheduleCategoryClose = useCallback((slug: string) => {
        cancelCloseTimer();
        closeTimerRef.current = window.setTimeout(() => {
            closeTimerRef.current = null;
            setActiveSlug((current) => (current === slug ? null : current));
        }, 180);
    }, [cancelCloseTimer]);

    const handlePointerDown = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            const drag = dragRef.current;
            drag.down = true;
            drag.moved = false;
            drag.x = event.clientX;
            drag.y = event.clientY;
        },
        [],
    );

    const handlePointerMove = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            const drag = dragRef.current;
            if (!drag.down) return;
            if (
                !drag.moved &&
                Math.abs(event.clientX - drag.x) + Math.abs(event.clientY - drag.y) > 6
            ) {
                drag.moved = true;
                setActiveSlug(null);
            }
        },
        [],
    );

    const handlePointerEnd = useCallback(() => {
        const drag = dragRef.current;
        if (!drag.down) return;
        drag.down = false;
        // Keep `moved` asserted briefly so the click that may follow a drag is
        // suppressed (embla also prevents it), then allow hover to work again.
        window.setTimeout(() => {
            dragRef.current.moved = false;
        }, 120);

        // Resume auto-slide shortly after the pointer settles on touch devices,
        // where there is no mouseenter/mouseleave to toggle the hover state.
        window.setTimeout(() => {
            syncAutoplay(canScrollNext);
        }, 400);
    }, [canScrollNext, syncAutoplay]);

    if (items.length === 0) {
        return null;
    }

    return (
        <div
            className="flex items-center gap-1 sm:gap-2"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
        >
            {canScrollPrev ? (
                <button
                    type="button"
                    onClick={scrollPrev}
                    aria-label="Previous categories"
                    className={arrowButtonClassName}
                >
                    <ChevronLeft aria-hidden="true" className="size-4" />
                </button>
            ) : null}

            <div
                ref={viewportRef}
                className="min-w-0 flex-1 overflow-hidden"
                data-testid="navbar-category-viewport"
            >
                <ul className="flex justify-between items-center">
                    {items.map((item) => (
                        <CategoryNavItem
                            key={item.slug}
                            item={item}
                            controller={{
                                open: activeSlug === item.slug,
                                isDragging,
                                onRequestOpen: () => openCategory(item.slug),
                                onScheduleClose: () => scheduleCategoryClose(item.slug),
                                onCancelClose: cancelCloseTimer,
                                onClose: () => closeCategory(item.slug),
                            }}
                        />
                    ))}
                </ul>
            </div>

            {canScrollNext ? (
                <button
                    type="button"
                    onClick={scrollNext}
                    aria-label="Next categories"
                    className={arrowButtonClassName}
                >
                    <ChevronRight aria-hidden="true" className="size-4" />
                </button>
            ) : null}
        </div>
    );
}
