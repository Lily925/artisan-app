import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";
import { NotFound, PageLoadError, PageLoading } from "./Routing";

// Loads /product/:id, so the page works from a shared link or a refresh. A product already in
// the catalog shows right away, and its like count stays live while the visitor is here.
// The API decides what exists: hidden products and suspended shops come back as 404.
export default function ProductRoute({ t, products, viewerId, onApiError, onLoaded, children }) {
  const { id } = useParams();
  const [fetched, setFetched] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | missing | failed
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let stale = false;
    setStatus("loading");
    api.getProduct(id)
      .then((p) => {
        if (stale) return;
        setFetched({ ...p, id: p._id });
        setStatus("ready");
        onLoaded?.(p._id);
      })
      .catch((err) => {
        if (stale) return;
        if (err.status === 401) onApiError(err); // expired login: loads again logged out
        else setStatus(err.status === 404 || err.status === 400 ? "missing" : "failed");
      });
    return () => { stale = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, viewerId, attempt]);

  if (status === "missing") return <NotFound t={t} />;
  const inCatalog = products.find((p) => p.id === id);
  const fresh = fetched?.id === id ? fetched : null;
  const product = fresh ? { ...fresh, likeCount: inCatalog?.likeCount ?? fresh.likeCount } : inCatalog;
  if (product) return children(product);
  if (status === "failed") return <PageLoadError t={t} onRetry={() => setAttempt((n) => n + 1)} />;
  return <PageLoading />;
}
