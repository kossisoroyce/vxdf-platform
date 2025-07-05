"""vxdf_search.py
Simple helper executable. Usage:
    python scripts/vxdf_search.py <vxdf_file> <query> <top_k>
Prints top-k chunks separated by "\n---\n" to stdout so the Node layer can ingest.

This mirrors the retrieval logic used in the Streamlit demo (use_case/app.py).
It attempts to embed the query with OpenAI `text-embedding-3-large` if an
API key is present; otherwise it falls back to a local SentenceTransformer
with a compatible dimension.  The dimension of the embeddings stored in the
VXDF file is inferred from any chunk's vector length.

No external arguments apart from the CLI are required.  This script is kept
very small to avoid adding heavy ML dependencies to the Node layer.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, List

import numpy as np
from vxdf import VXDFReader
from vxdf.auth import get_openai_api_key

try:
    from sentence_transformers import SentenceTransformer  # type: ignore
except ImportError:
    SentenceTransformer = None  # type: ignore

try:
    import openai  # type: ignore
except ImportError:
    openai = None  # type: ignore


def _embed(sentences: List[str], dim: int) -> np.ndarray:  # type: ignore
    api_key = get_openai_api_key()
    if api_key and openai is not None and dim in {1536, 3072}:
        try:
            from openai import OpenAI  # type: ignore

            client: Any = OpenAI(api_key=api_key)
            resp = client.embeddings.create(
                model="text-embedding-3-large", input=sentences
            )
            vecs = np.asarray([d.embedding for d in resp.data], dtype=np.float32)
            if vecs.shape[1] == dim:
                return vecs
        except Exception:
            pass  # fall through
    if SentenceTransformer is None:
        raise RuntimeError(
            "sentence-transformers not installed and OpenAI fallback failed"
        )
    st_model_map = {384: "all-MiniLM-L6-v2", 768: "all-mpnet-base-v2"}
    model_name = st_model_map.get(dim, "all-MiniLM-L6-v2")
    model = SentenceTransformer(model_name)
    return model.encode(sentences, normalize_embeddings=True)


def main() -> None:
    if len(sys.argv) < 3:
        print("Usage: vxdf_search.py <vxdf_file> <query> [top_k]", file=sys.stderr)
        sys.exit(1)

    vxdf_path = Path(sys.argv[1])
    query = sys.argv[2]
    top_k = int(sys.argv[3]) if len(sys.argv) > 3 else 4

    reader = VXDFReader(str(vxdf_path))
    ids = list(reader.offset_index.keys())
    vecs = np.asarray([reader.get_chunk(cid)["vector"] for cid in ids], dtype=np.float32)
    dim = vecs.shape[1]

    q_vec = _embed([query], dim)[0]
    sims = np.dot(vecs, q_vec)
    top_idx = np.argsort(sims)[-top_k:][::-1]

    chunks = []
    for idx in top_idx:
        cid = ids[idx]
        score = float(sims[idx])
        text = reader.get_chunk(cid)["text"]
        chunks.append(f"EU:{cid} (score {score:.2f}): {text}")

    print("\n---\n".join(chunks))


if __name__ == "__main__":
    main()
