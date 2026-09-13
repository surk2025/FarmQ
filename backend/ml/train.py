import os
import json
import numpy as np
import pandas as pd
from typing import Dict, Any, List

class Node:
    def __init__(self, feature=None, threshold=None, left=None, right=None, value=None):
        self.feature = feature
        self.threshold = threshold
        self.left = left
        self.right = right
        self.value = value

    def to_dict(self):
        if self.value is not None:
            return {"value": float(self.value)}
        return {
            "feature": self.feature,
            "threshold": float(self.threshold),
            "left": self.left.to_dict(),
            "right": self.right.to_dict()
        }

    @classmethod
    def from_dict(cls, d):
        if "value" in d:
            return cls(value=d["value"])
        return cls(
            feature=d["feature"],
            threshold=d["threshold"],
            left=cls.from_dict(d["left"]),
            right=cls.from_dict(d["right"])
        )

class SimpleDecisionTreeRegressor:
    def __init__(self, max_depth=6, min_samples_split=5):
        self.max_depth = max_depth
        self.min_samples_split = min_samples_split
        self.root = None

    def fit(self, X: np.ndarray, y: np.ndarray, feature_names: List[str]):
        self.feature_names = feature_names
        self.root = self._build_tree(X, y, depth=0)

    def _build_tree(self, X: np.ndarray, y: np.ndarray, depth: int):
        n_samples, n_features = X.shape
        if depth >= self.max_depth or n_samples < self.min_samples_split or np.var(y) < 1e-4:
            return Node(value=np.mean(y))

        best_feat, best_thresh, best_var_red = None, None, -1
        current_var = np.var(y) * n_samples

        for f_idx in range(n_features):
            thresholds = np.percentile(X[:, f_idx], [20, 40, 60, 80])
            for thresh in thresholds:
                left_mask = X[:, f_idx] <= thresh
                right_mask = ~left_mask
                if np.sum(left_mask) < 2 or np.sum(right_mask) < 2:
                    continue
                var_red = current_var - (np.var(y[left_mask]) * np.sum(left_mask) + np.var(y[right_mask]) * np.sum(right_mask))
                if var_red > best_var_red:
                    best_var_red = var_red
                    best_feat = f_idx
                    best_thresh = thresh

        if best_feat is None:
            return Node(value=np.mean(y))

        left_mask = X[:, best_feat] <= best_thresh
        left_node = self._build_tree(X[left_mask], y[left_mask], depth + 1)
        right_node = self._build_tree(X[~left_mask], y[~left_mask], depth + 1)

        return Node(feature=self.feature_names[best_feat], threshold=best_thresh, left=left_node, right=right_node)

    def predict_one(self, node: Node, sample: Dict[str, float]) -> float:
        if node.value is not None:
            return node.value
        val = sample[node.feature]
        if val <= node.threshold:
            return self.predict_one(node.left, sample)
        return self.predict_one(node.right, sample)

class SimpleRandomForestRegressor:
    def __init__(self, n_estimators=10, max_depth=5):
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.trees: List[SimpleDecisionTreeRegressor] = []
        self.feature_names = []

    def fit(self, X: np.ndarray, y: np.ndarray, feature_names: List[str]):
        self.feature_names = feature_names
        self.trees = []
        n_samples = X.shape[0]
        for i in range(self.n_estimators):
            indices = np.random.choice(n_samples, size=int(n_samples * 0.8), replace=True)
            tree = SimpleDecisionTreeRegressor(max_depth=self.max_depth)
            tree.fit(X[indices], y[indices], feature_names)
            self.trees.append(tree)

    def predict(self, sample: Dict[str, float]) -> float:
        preds = [tree.predict_one(tree.root, sample) for tree in self.trees]
        return float(np.mean(preds))

    def save(self, file_path: str):
        data = {
            "feature_names": self.feature_names,
            "trees": [tree.root.to_dict() for tree in self.trees]
        }
        with open(file_path, "w") as f:
            json.dump(data, f)

    @classmethod
    def load(cls, file_path: str):
        with open(file_path, "r") as f:
            data = json.load(f)
        rf = cls(n_estimators=len(data["trees"]))
        rf.feature_names = data["feature_names"]
        rf.trees = []
        for tree_dict in data["trees"]:
            tree = SimpleDecisionTreeRegressor()
            tree.root = Node.from_dict(tree_dict)
            rf.trees.append(tree)
        return rf

def generate_queue_dataset(n_samples: int = 1000) -> pd.DataFrame:
    np.random.seed(42)
    farmers_ahead = np.random.randint(0, 36, size=n_samples)
    avg_processing_time = np.random.uniform(5.5, 13.0, size=n_samples)
    crop_quantity = np.random.uniform(10.0, 120.0, size=n_samples)
    active_counters = np.random.choice([1, 2, 3, 4], p=[0.25, 0.45, 0.20, 0.10], size=n_samples)
    current_queue_length = farmers_ahead + np.random.randint(1, 15, size=n_samples)
    historical_avg = np.random.uniform(20.0, 150.0, size=n_samples)
    day_of_week = np.random.randint(0, 7, size=n_samples)
    time_slot_hour = np.random.randint(8, 18, size=n_samples)

    base_wait = (farmers_ahead / np.maximum(1, active_counters)) * avg_processing_time
    volume_factor = 1.0 + (crop_quantity / 200.0) * 0.25
    peak_factor = np.where((time_slot_hour >= 10) & (time_slot_hour <= 13), 1.15, 1.0)
    day_factor = np.where(day_of_week == 0, 1.10, 1.0)
    blended_wait = (0.85 * (base_wait * volume_factor * peak_factor * day_factor) + 0.15 * historical_avg)
    noise = np.random.normal(0, 2.5, size=n_samples)
    actual_wait = np.maximum(2, blended_wait + noise)
    actual_wait = np.where(farmers_ahead == 0, np.random.uniform(1.0, 4.0, size=n_samples), actual_wait)

    return pd.DataFrame({
        "farmers_ahead": farmers_ahead,
        "avg_processing_time": np.round(avg_processing_time, 1),
        "crop_quantity": np.round(crop_quantity, 1),
        "active_counters": active_counters,
        "current_queue_length": current_queue_length,
        "historical_avg": np.round(historical_avg, 1),
        "day_of_week": day_of_week,
        "time_slot_hour": time_slot_hour,
        "actual_wait_minutes": np.round(actual_wait, 1)
    })

def train_and_save_model():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    model_dir = os.path.join(base_dir, "model")
    os.makedirs(model_dir, exist_ok=True)
    model_path = os.path.join(model_dir, "waiting_time_model.json")
    meta_path = os.path.join(model_dir, "model_meta.json")

    print("Generating synthetic agricultural procurement queue dataset...", flush=True)
    df = generate_queue_dataset(n_samples=800)
    features = [
        "farmers_ahead",
        "avg_processing_time",
        "crop_quantity",
        "active_counters",
        "current_queue_length",
        "historical_avg",
        "day_of_week",
        "time_slot_hour"
    ]
    X = df[features].to_numpy()
    y = df["actual_wait_minutes"].to_numpy()

    # Split train/test
    split_idx = int(0.8 * len(X))
    X_train, X_test = X[:split_idx], X[split_idx:]
    y_train, y_test = y[:split_idx], y[split_idx:]

    print("Training Random Forest Regressor (Ensemble of Decision Trees)...", flush=True)
    rf = SimpleRandomForestRegressor(n_estimators=12, max_depth=6)
    rf.fit(X_train, y_train, features)

    preds = [rf.predict(dict(zip(features, x))) for x in X_test]
    mae = float(np.mean(np.abs(y_test - preds)))
    print(f"Model Training Complete! Test MAE: {mae:.2f} minutes", flush=True)

    rf.save(model_path)
    meta = {
        "model_type": "RandomForestRegressor (Ensemble of 12 Decision Trees)",
        "features": features,
        "mae_minutes": round(mae, 2),
        "n_samples": len(df),
        "framework": "NumPy & Pandas Machine Learning Pipeline"
    }
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)
    print(f"Saved model to {model_path} and metadata to {meta_path}", flush=True)

if __name__ == "__main__":
    train_and_save_model()
