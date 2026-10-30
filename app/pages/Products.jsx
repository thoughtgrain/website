/**
 * Products.jsx — /products/ and /products/:slug/
 *
 * The hero image is whatever has been saved to src/assets/products/<slug>.*.
 * The old generator scraped it from the product page's og:image at build time;
 * that's gone, because a live HTTP round trip in the middle of a build was the
 * single flakiest thing about it and the cache it checked never existed. Drop a
 * file in by hand and it gets used; otherwise the typographic placeholder does
 * the job, which is a perfectly good card.
 */

import { content } from '../content.js';
import { useBase } from '../base.js';
import Link from '../Link.jsx';
import Html from '../components/Html.jsx';
import FeedLink from '../components/FeedLink.jsx';

/** Any product image committed under src/assets/products/, by slug. */
const images = import.meta.glob('/src/assets/products/*.{jpg,jpeg,png,webp,avif,gif}', {
  eager: true,
  import: 'default',
});

function imageFor(slug) {
  const hit = Object.keys(images).find((p) => p.split('/').pop().replace(/\.\w+$/, '') === slug);
  return hit ? images[hit] : null;
}

function Cover({ product }) {
  const src = imageFor(product.slug);
  if (!src) {
    return (
      <div className="cover-placeholder cover-placeholder--paper cover-placeholder--book">
        {product.title}
      </div>
    );
  }
  return <img className="product-card__img" src={src} alt={product.imageAlt || product.title} />;
}

export function ProductsIndex() {
  return (
    <main id="main">
      <div className="container--narrow section">
        <header className="page-header page-header--left">
          <span className="kicker">Products</span>
          <h1>Things I’m into</h1>
          <p className="lead">
            A small list of products I keep coming back to. Each links out to where you
            can find it.
          </p>
          <FeedLink href="/products/feed.xml" label="products" />
        </header>

        <ul className="product-grid">
          {content.products.map((p) => (
            <li key={p.slug}>
              <Link className="product-card" to={`/products/${p.slug}/`}>
                <div className="product-card__cover"><Cover product={p} /></div>
                <h3 className="product-card__title">{p.title}</h3>
                {p.price && <div className="product-card__price">{p.price}</div>}
                <p className="product-card__note">{p.note}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}

export function Product({ route }) {
  const slug = route.split('/').filter(Boolean)[1];
  const product = content.products.find((p) => p.slug === slug);
  if (!product) {
    return <main id="main"><div className="container section"><h1>Not found</h1></div></main>;
  }

  return (
    <main id="main">
      <article className="container--narrow section reader reader--wide product-reader">
        <Link className="btn btn--link reader__back" to="/products/">
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12,19 5,12 12,5" /></svg>
          <span className="reader__back-label">All products</span>
        </Link>

        <header className="reader__head">
          <div className="reader__kicker"><span className="kicker">Product</span></div>
          <h1>{product.title}</h1>
          <div className="reader__meta">
            {product.price && <span className="kicker">{product.price}</span>}
            {product.tag1 && <span className="kicker">&middot; {product.tag1}</span>}
            {product.tag2 && <span className="kicker">&middot; {product.tag2}</span>}
          </div>
        </header>

        <div className="cover-frame cover-frame--book product-reader__cover">
          <Cover product={product} />
        </div>

        <div className="prose">
          {product.note && <p className="lead">{product.note}</p>}
          <Html html={product.bodyHtml} />
        </div>

        {product.url && (
          <p className="product-reader__buy">
            <a className="btn btn--primary" href={product.url} target="_blank" rel="noopener noreferrer">
              Buy from {product.urlHost}
              <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M9 7h8v8" /></svg>
            </a>
          </p>
        )}
      </article>
    </main>
  );
}
