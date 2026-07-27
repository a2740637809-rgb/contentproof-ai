import numpy as np

from app.semantic_analysis import cluster_vectors, pack_vector, unpack_vector


def test_vectors_round_trip_as_float32():
    vector = np.array([0.2, 0.4, 0.8], dtype=np.float32)
    restored = unpack_vector(pack_vector(vector), dimensions=3)
    assert restored.dtype == np.float32
    assert np.allclose(restored, vector)


def test_small_semantic_groups_are_clustered_without_forcing_noise():
    vectors = np.array(
        [
            [1.0, 0.0],
            [0.98, 0.02],
            [0.0, 1.0],
            [0.02, 0.98],
        ],
        dtype=np.float32,
    )
    labels, method = cluster_vectors(vectors, distance_threshold=0.25)
    assert method == "agglomerative-cosine"
    assert labels[0] == labels[1]
    assert labels[2] == labels[3]
    assert labels[0] != labels[2]


def test_semantic_api_records_real_model_and_cluster_method(client, monkeypatch):
    project = client.post(
        "/api/v2/projects", json={"name": "语义分析", "goal": "发现读者问题"}
    ).json()
    client.post(
        f"/api/v2/projects/{project['id']}/imports/manual",
        json={"comments": ["怎么报名？", "报名入口在哪？", "活动安全吗？"]},
    )

    monkeypatch.setattr(
        "app.v2_api.embed_texts",
        lambda texts, model_name: np.array(
            [[1.0, 0.0], [0.98, 0.02], [0.0, 1.0]], dtype=np.float32
        ),
    )
    response = client.post(
        f"/api/v2/projects/{project['id']}/analysis",
        json={"mode": "semantic"},
    )
    assert response.status_code == 201
    assert response.json()["embedding_model"] == "BAAI/bge-small-zh-v1.5"
    assert response.json()["clustering_method"] == "agglomerative-cosine"
