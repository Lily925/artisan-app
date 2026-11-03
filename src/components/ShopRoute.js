import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { api } from "../api";
import { shopPath, artisanAboutPath } from "../paths";
import { NotFound, PageLoadError, PageLoading } from "./Routing";

// Loads /shop/:slug, so the page works from a shared link or a refresh. The public API only
// returns approved shops; an owner still reaches their own unapproved shop through the
// catalog, which is the one place the API gives it to them.
export default function ShopRoute({ t, about = false, products, catalogReady, children }) {
  const { slug } = useParams();
  const [fetched, setFetched] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | missing | failed
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let stale = false;
    setStatus("loading");
    setFetched(null);
    api.getArtisan(slug)
      .then((artisan) => { if (!stale) { setFetched(artisan); setStatus("ready"); } })
      .catch((err) => { if (!stale) setStatus(err.status === 404 || err.status === 400 ? "missing" : "failed"); });
    return () => { stale = true; };
  }, [slug, attempt]);

  const own = products.find((p) => p.artisan && (p.artisan.slug === slug || p.artisan._id === slug))?.artisan;
  const artisan = fetched || (status !== "loading" && own) || null;

  if (status === "loading" || !catalogReady) return <PageLoading />; // the products come from the catalog
  if (!artisan) return status === "failed" ? <PageLoadError t={t} onRetry={() => setAttempt((n) => n + 1)} /> : <NotFound t={t} />;
  // One address per shop: an old id link or different capitals land on the slug.
  if (artisan.slug && artisan.slug !== slug) return <Navigate to={about ? artisanAboutPath(artisan) : shopPath(artisan)} replace />;
  return children(artisan);
}
