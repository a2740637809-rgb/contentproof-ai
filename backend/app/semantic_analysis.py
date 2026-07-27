from functools import lru_cache

import numpy as np
from sklearn.cluster import AgglomerativeClustering
from sklearn.feature_extraction.text import TfidfVectorizer


DEFAULT_EMBEDDING_MODEL = "BAAI/bge-small-zh-v1.5"


def pack_vector(vector: np.ndarray) -> bytes:
    return np.asarray(vector, dtype=np.float32).tobytes()


def unpack_vector(value: bytes, dimensions: int) -> np.ndarray:
    vector = np.frombuffer(value, dtype=np.float32)
    if vector.size != dimensions:
        raise ValueError("向量维度与记录不一致")
    return vector.copy()


@lru_cache(maxsize=2)
def load_embedding_model(model_name: str = DEFAULT_EMBEDDING_MODEL):
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer(model_name, device="cpu")


def embed_texts(
    texts: list[str], model_name: str = DEFAULT_EMBEDDING_MODEL
) -> np.ndarray:
    if not texts:
        return np.empty((0, 0), dtype=np.float32)
    model = load_embedding_model(model_name)
    values = model.encode(
        texts,
        batch_size=16,
        show_progress_bar=False,
        normalize_embeddings=True,
        convert_to_numpy=True,
    )
    return np.asarray(values, dtype=np.float32)


def fallback_text_vectors(texts: list[str]) -> np.ndarray:
    """Offline fallback when the optional BGE model has not been downloaded."""
    if not texts:
        return np.empty((0, 0), dtype=np.float32)
    values = TfidfVectorizer(analyzer="char", ngram_range=(2, 4), min_df=1).fit_transform(texts)
    return np.asarray(values.toarray(), dtype=np.float32)


def cluster_vectors(
    vectors: np.ndarray, distance_threshold: float = 0.42
) -> tuple[list[int], str]:
    vectors = np.asarray(vectors, dtype=np.float32)
    if len(vectors) < 2:
        return [0] * len(vectors), "single-item"
    if len(vectors) < 30:
        model = AgglomerativeClustering(
            n_clusters=None,
            metric="cosine",
            linkage="average",
            distance_threshold=distance_threshold,
        )
        return model.fit_predict(vectors).astype(int).tolist(), "agglomerative-cosine"

    from hdbscan import HDBSCAN

    model = HDBSCAN(min_cluster_size=max(3, len(vectors) // 15), metric="euclidean")
    return model.fit_predict(vectors).astype(int).tolist(), "hdbscan"
