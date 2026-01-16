from calendar import c
import json
import csv
import re
from pathlib import Path
import numpy as np
import similaritymeasures
from scipy.spatial.distance import directed_hausdorff
from scipy.stats import kendalltau
import matplotlib.pyplot as plt
import cv2
import os
import argparse
import pandas as pd

from PIL import Image, ImageDraw, ImageFont
from torch import res
import pandas as pd

os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

import numpy as np

# 建議的有向骨架樹（OpenPose BODY_25）
# 以 8(midHip) 當全身 root，由內向外展開
DIRECTED_BONES = [
    (8, 1),            # torso up
    (1, 0),            # neck->head
    (0, 15), (15, 17), # head left chain
    (0, 16), (16, 18), # head right chain

    (1, 2), (2, 3), (3, 4),  # right arm (OpenPose index 2/3/4)
    (1, 5), (5, 6), (6, 7),  # left arm  (OpenPose index 5/6/7)

    (8, 9), (9, 10), (10, 11), (11, 24), (11, 22), (22, 23),  # right leg+foot
    (8, 12), (12, 13), (13, 14), (14, 21), (14, 19), (19, 20) # left  leg+foot
]

def _safe_unit(v):
    """回傳單位向量；若長度為 0 或有 NaN，回傳 None。"""
    if v is None: return None
    if np.any(np.isnan(v)): return None
    n = np.linalg.norm(v)
    if n <= 1e-12: return None
    return v / n



def _bone_length(arr, i, j):
    """點 j 到點 i 的長度（arr: (25,3) 單幀關節）。"""
    if np.any(np.isnan(arr[i])) or np.any(np.isnan(arr[j])): 
        return None
    return np.linalg.norm(arr[j] - arr[i])

def _compute_target_lengths(coach, use_avg_lengths=False):
    """
    產生 target 長度：
    - use_avg_lengths=False: 逐幀用教練對應骨骼長度（動態）
    - True: 用教練全片平均長度（靜態）
    回傳 shape = (frames, len(DIRECTED_BONES))
    """
    F = coach.shape[0]
    B = len(DIRECTED_BONES)
    tgt = np.zeros((F, B), dtype=float)

    if use_avg_lengths:
        # 先計算每條骨骼在教練影片中的平均長度
        avg_len = np.zeros(B, dtype=float)
        for b_idx, (p, c) in enumerate(DIRECTED_BONES):
            lens = []
            for f in range(F):
                L = _bone_length(coach[f], p, c)
                if L is not None:
                    lens.append(L)
            avg_len[b_idx] = np.mean(lens) if len(lens) else 0.0
        tgt[:] = avg_len[None, :]  # 全幀使用同一組平均長度
    else:
        # 逐幀長度
        for f in range(F):
            for b_idx, (p, c) in enumerate(DIRECTED_BONES):
                L = _bone_length(coach[f], p, c)
                tgt[f, b_idx] = 0.0 if (L is None) else L
    return tgt

def normalize_student_to_coach_lengths(student: np.ndarray,
                                       coach: np.ndarray,
                                       keep_root_xyz=True,
                                       use_avg_lengths=False) -> np.ndarray:
    """
    依照教練的骨骼長度，將學生每條骨骼沿原方向伸縮到相同長度。
    - 由 8(midHip) 為 root，依 DIRECTED_BONES 由內向外推算
    - keep_root_xyz=True：保留 root(8) 的原始位置（僅子節點被重算）
    - use_avg_lengths=True：用教練全片平均長度；False：逐幀長度
    回傳：與 student 同形狀的新 array（(frames, 25, 3)）
    """
    assert student.shape == coach.shape and student.shape[1] >= 25 and student.shape[2] == 3
    F = student.shape[0]
    out = student.copy()

    # 目標長度表
    tgt_lens = _compute_target_lengths(coach, use_avg_lengths=use_avg_lengths)

    for f in range(F):
        frame = out[f]

        # 1) 鎖住 root（8）位置：可選擇保留或置中到原點
        if keep_root_xyz:
            root_pos = frame[8].copy()
        else:
            # 若你想把 8 放到原點，可改成：
            # root_pos = np.zeros(3, dtype=float)
            root_pos = frame[8].copy()

        # 2) 由內向外重建：每條骨骼只改 child
        #    注意：同一 child 可能是多分支末端之一，但在此有向樹裡，每個 child 只有一個 parent
        frame[8] = root_pos  # 固定 root

        for b_idx, (p, c) in enumerate(DIRECTED_BONES):
            parent = frame[p]
            child  = frame[c]

            # parent 尚未定義（或 NaN）就跳過
            if np.any(np.isnan(parent)) or np.any(np.isnan(child)):
                continue

            # 取「學生原先的方向」
            dir_vec = _safe_unit(child - parent)
            if dir_vec is None:
                # 無法決定方向 → 保留原 child
                continue

            L = tgt_lens[f, b_idx]
            if L <= 0:
                # 沒有合理的目標長度 → 不動
                continue

            # 重新設定 child：parent + 原方向 * 教練目標長度
            frame[c] = parent + dir_vec * L

        out[f] = frame

    return out

OPENPOSE_CONNECTIONS = [
    (0, 16), (0, 15), (15, 17), (16, 18), #face
    (0, 1), #neck
    (1, 8), #body 
    (1, 5), (5, 6), (6, 7), #left arm
    (1, 2), (2, 3), (3, 4), #right arm
    (8, 9), (8, 12), #hips
    (12, 13), (13, 14), #left leg
    (14, 21), (14, 19), (19, 20), #left foot
    (9, 10), (10, 11), #right leg
    (11, 24), (11, 22), (22, 23) # right foot
]
REPO_ROOT = Path(__file__).resolve().parents[1]
_DEFAULT_DATA_ROOT = REPO_ROOT / "datasets" / "EZmocap" / "CASA_outputs"
_SIBLING_DATA_ROOT = REPO_ROOT.parent / "Data" / "datasets" / "EZmocap" / "CASA_outputs"
_ENV_DATA_ROOT = os.environ.get("SOP_DATA_ROOT")
if _ENV_DATA_ROOT:
    DATA_ROOT = Path(_ENV_DATA_ROOT)
elif _SIBLING_DATA_ROOT.exists():
    DATA_ROOT = _SIBLING_DATA_ROOT
else:
    DATA_ROOT = _DEFAULT_DATA_ROOT
ANALYSIS_ROOT = REPO_ROOT / "datasets" / "EZmocap" / "Analysis_results"

def load_json(file_path):
    with open(file_path, 'r') as file:
        return json.load(file)
def extract_skeleton_joints(data, frames, joints):
    result = []
    for frame in frames:
        for joint in joints:
            result.append(data[frame][joint])
    return np.array(result)

def extract_skeleton_data(data, frames):
    result = []
    for frame in frames:
        # print(f"Extracting frame {frame} data: {data[frame].shape}")    
        result.append(data[frame])
    return np.array(result)
def calculate_frechet_distance(data1, data2):
    return similaritymeasures.frechet_dist(data1, data2)
def calculate_hausdorff_distance(data1, data2):
    d1, idx1, idx1_match = directed_hausdorff(data1, data2)
    d2, idx2, idx2_match = directed_hausdorff(data2, data1)

    ## idx 可以知道是哪一個joint差最多
    return max(d1, d2)
def calculate_kendalls_tau(data1, data2):
    def get_motion_magnitude(data):
        return [np.linalg.norm(data[i+1] - data[i]) for i in range(len(data)-1)]
    mag1 = get_motion_magnitude(data1)
    mag2 = get_motion_magnitude(data2)
    min_len = min(len(mag1), len(mag2))
    tau, _ = kendalltau(mag1[:min_len], mag2[:min_len])
    return tau

def generate_feedback(frechet_percent, hausdorff_percent, kendall_percent):

    # 個別回饋
    if frechet_percent > 80:
        frechet_feedback = "-Motion smoothness: stable"
    elif frechet_percent > 60:
        frechet_feedback = "-Motion smoothness: slightly off"
    else:
        frechet_feedback = "-Motion smoothness: needs improvement"

    if hausdorff_percent > 80:
        hausdorff_feedback = "-Pose accuracy: good"
    elif hausdorff_percent > 60:
        hausdorff_feedback = "-Pose accuracy: slightly off"
    else:
        hausdorff_feedback = "-Pose accuracy: needs correction"

    if kendall_percent > 80:
        kendall_feedback = "-Motion timing/order: consistent"
    elif kendall_percent > 60:
        kendall_feedback = "-Motion timing/order: slightly different"
    else:
        kendall_feedback = "-Motion timing/order: needs correction"

    # Overall 評語：選最低 percent 來給結論
    min_percent = min(frechet_percent, hausdorff_percent, kendall_percent)
    if min_percent > 80:
        overall = "Overall motion looks good."
    elif min_percent > 60:
        overall = "Overall is OK; adjust details."
    else:
        overall = "Overall needs improvement; focus on fundamentals."

    return frechet_feedback, hausdorff_feedback, kendall_feedback, overall


# def parse_score(value):
#     """轉換帶有顏色標記的文字成分數 (0-100)"""
#     if "(green)" in value:
#         return 100
#     elif "(lerp(yellow→red:" in value:
#         try:
#             num = float(value.split(":")[-1].strip("))"))
#             return int(100 * (1 - num))  # 值越大分越低
#         except:
#             return 50
#     elif "(yellow)" in value:
#         return 60
#     elif "(red)" in value:
#         return 30
#     else:
#         return 50  # default fallback
def parse_score(value):
    """轉換帶有顏色標記的文字成分數 (0-100)"""
    if "(green)" in value:
        return 100
    elif "(yellow)" in value:
        return 60
    elif "(red)" in value:
        return 30
    else:
        return 50  # default fallback




def classify_step(biomech_colors):
    if len(biomech_colors) == 1:
        color = biomech_colors[0]
        return "correct" if "green" in color else "wrong" if "red" in color else "mid"
    if all("green" in c for c in biomech_colors):
        return "correct"
    elif all("red" in c for c in biomech_colors):
        return "wrong"
    return "mid"

def save_analysis_results(data_name, analysis_results, step_ranges):
    step_output_path = DATA_ROOT / data_name / "aligned" / "step_frame_ranges.json"
    output_dict_path = DATA_ROOT / data_name / "analysis_results.json"

    with open(step_output_path, 'w') as f:
        json.dump(step_ranges, f, indent=4)
    with open(output_dict_path, 'w', encoding='utf-8') as f:
        json.dump(analysis_results, f, ensure_ascii=False, indent=2)

    print(f"✅ 分析結果已輸出至 {output_dict_path}")

def similarity_percentages(frechet: float, hausdorff: float, kendall_tau: float) -> dict:
    """
    將 Frechet 距離、Hausdorff 距離、Kendall's Tau 轉換為 0~100 的相似度百分比

    傳入：
        frechet: Frechet distance (越小越好)
        hausdorff: Hausdorff distance (越小越好)
        kendall_tau: Kendall's Tau (越接近 1 越好)

    回傳：
        字典，包含 frechet_percent, hausdorff_percent, kendall_percent
    """
    # 可根據實驗調整的最大容忍距離，超過就視為 0%
    FRECHET_MAX = 5.0
    HAUSDORFF_MAX = 5.0

    # Frechet/Hausdorff 距離的線性反比轉換
    frechet_percent = max(0, 100 * (1 - frechet / FRECHET_MAX))
    hausdorff_percent = max(0, 100 * (1 - hausdorff / HAUSDORFF_MAX))

    # Kendall's Tau 本身就介於 -1 ~ 1，通常只取 0~1
    kendall_percent = max(0, min(1.0, kendall_tau)) * 100

    return round(frechet_percent, 1),round(hausdorff_percent, 1), round(kendall_percent, 1)
    
def split_video_by_steps(video_path, output_folder, steps, cam_id):
    """
    將影片依據指定的步驟 frame 範圍進行切割，每步驟輸出一個影片。

    :param video_path: 要處理的影片路徑
    :param output_folder: 輸出資料夾
    :param steps: 每個步驟的 frame 範圍
    :param cam_id: 相機編號（用於檔名）
    """
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        print(f"❌ 無法打開影片: {video_path}")
        return

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = int(cap.get(cv2.CAP_PROP_FPS))

    for step_idx, (step_name, (frame_range, _)) in enumerate(steps.items(), start=1):
        output_path = Path(output_folder) / f"step{step_idx}_cam{cam_id}.mp4"
        out = cv2.VideoWriter(str(output_path), cv2.VideoWriter_fourcc(*'mp4v'), fps, (width, height))
        print(f"📤 輸出: {output_path} ({frame_range[0]} ~ {frame_range[-1]})")

        for frame_idx in range(frame_range[0], frame_range[-1] + 1):
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
            ret, frame = cap.read()
            if not ret:
                print(f"⚠️ 無法讀取 frame {frame_idx}，跳過")
                continue
            out.write(frame)

        out.release()

    cap.release()
    print(f"✅ 已完成影片切割：{video_path}")

def split_data_by_steps(data, steps, output_name, output_folder):
    """
    根據步驟的 frame range，分割 data 並存成對應 JSON 檔案。

    :param data: numpy array，形狀為 (frame, joint, dim)
    :param steps: dict，每步為 (frame_range, joint_indices)，但此版本不會用到 joint_indices
    :param output_name: 輸出檔案命名的前綴
    :param output_folder: 儲存資料夾
    """
    print(f"📊 分析數據，總幀數: {len(data)}")
    print(f"Data shape: {data.shape}")
    os.makedirs(output_folder, exist_ok=True)

    for idx, (step_name, (frame_range, _)) in enumerate(steps.items(), start=1):
        step_frames = data[frame_range[0]:frame_range[-1] + 1]
        print(f"✂️ Step {idx}: {step_name} → shape = {step_frames.shape}")

        # 儲存 JSON
        output_path = Path(output_folder) / f"step{idx}_{output_name}.json"
        with open(output_path, 'w') as f:
            json.dump(step_frames.tolist(), f, indent=4)
            print(f"✅ 已儲存 {step_name} 數據至 {output_path}")

def split_all_videos_by_steps(data_name, steps):
    for cam_id in range(1, 5):
        for role in ["student", "coach"]:
            video_path = DATA_ROOT / data_name / "aligned" / f"{role}_video" / f"cam{cam_id}_aligned.mp4"
            output_folder = DATA_ROOT / data_name / "aligned" / f"{role}_video"
            split_video_by_steps(video_path, output_folder, steps, cam_id)

def split_all_data_by_steps(data_name, steps):
    data_output_folder = DATA_ROOT / data_name / "aligned" / "data"
    data_files = {
        "student_aligned_skeleton": data_output_folder / "student_aligned_skeleton.json",
        "coach_aligned_skeleton": data_output_folder / "coach_aligned_skeleton.json",
        "student_aligned_bat": data_output_folder / "student_aligned_bat.json",
        "coach_aligned_bat": data_output_folder / "coach_aligned_bat.json"
    }

    for name, path in data_files.items():
        data = np.array(load_json(path))
        split_data_by_steps(data, steps, name, data_output_folder)


def update_color(val, tolerance=0.1, mid_ratio=3.0, abs_val=True):
    """
    使用誤差容忍範圍（tolerance）與中間帶倍率（mid_ratio）定義顏色區間。

    - 綠色： val <= tolerance
    - 黃色： tolerance < val <= tolerance * mid_ratio
    - 紅色： val > tolerance * mid_ratio
    """
    val = abs(val) if abs_val else val
    if val <= tolerance:
        return (0, 255, 0), "green"
    elif val <= tolerance * mid_ratio:
        return (255, 255, 0), "yellow"
    else:
        return (255, 0, 0), "red"

# def get_general_motion_feedback_level(val: float, tolerance: float = 0.1, abs_val: bool = True) -> str:
#     val = abs(val) if abs_val else val
#     if val <= tolerance:
#         return "正確"
#     elif val <= 0.2:
#         return "適當"
#     elif val <= 0.5:
#         return "偏差稍大"
#     elif val <= 1.0:
#         return "差異過大"
#     else:
#         return "嚴重錯誤"

def xyzout(point, i):
    # 根據 i 值，將 point 投影到某個平面
    if np.any(np.isnan(point)):
        return np.array([0, 0, 0])

    if i == 0:
        return np.array([0, point[1], point[2]])  # 去除 x 分量，投影到 YZ 平面
    elif i == 1:
        return np.array([point[0], 0, point[2]])  # 去除 y 分量，投影到 XZ 平面
    elif i == 2:
        return np.array([point[0], point[1], 0])  # 去除 z 分量，投影到 XY 平面
    return point  # 若 i 不為 0~2，原樣回傳
def angle_between(v1, v2):
    unit_v1 = v1 / np.linalg.norm(v1)  # 單位化 v1
    unit_v2 = v2 / np.linalg.norm(v2)  # 單位化 v2
    dot_product = np.clip(np.dot(unit_v1, unit_v2), -1.0, 1.0)  # 內積結果限制在 [-1, 1] 避免誤差
    return np.degrees(np.arccos(dot_product))  # 回傳夾角（單位：度）
def get_angle_with_xz_plane(vec: np.ndarray) -> float:
    """
    計算一個向量與 XZ 平面的夾角，使用 angle_between()
    """
    vec_proj = np.array([vec[0], 0.0, vec[2]])  # 投影到 XZ 平面（Y 分量設為 0）
    return angle_between(vec, vec_proj)

def compute_shoulder_angle(joints: np.ndarray) -> float:
    """
    計算左右肩膀的傾斜角度（以 Y 差 / X 差 → atan2）
    回傳角度（degrees），若完全水平則為 0°
    """
    right_shoulder = joints[2]
    left_shoulder = joints[5]

    dy = right_shoulder[1] - left_shoulder[1]
    dx = right_shoulder[0] - left_shoulder[0]
    angle_rad = np.arctan2(dy, dx)
    angle_deg = np.degrees(angle_rad)
    return angle_deg

def get_center_of_gravity(skeleton: np.ndarray, frame='avg', project='none') -> np.ndarray:
    """
    計算中心點 (neck + midhip)/2 作為重心參考。

    Args:
        skeleton: shape (frames, 25, 3)
        frame: 'avg' 使用整段平均，或傳入指定 frame index
        project: 'xz' 僅保留 X,Z 分量；'none' 保留原始 XYZ

    Returns:
        np.ndarray shape (3,) 或 (2,) 的重心座標
    """
    if isinstance(frame, int):
        neck = skeleton[frame, 1]
        midhip = skeleton[frame, 8]
    elif frame == 'avg':
        neck = np.mean(skeleton[:, 1], axis=0)
        midhip = np.mean(skeleton[:, 8], axis=0)
    else:
        raise ValueError(f"Unsupported frame value: {frame}")

    cog = (neck + midhip) / 2

    if project == 'xz':
        return np.array([cog[0], cog[2]])
    return cog

def get_center_of_gravity_midhip_only(skeleton: np.ndarray, frame='avg', project='none') -> np.ndarray:
    """
    使用 joint 8（MidHip）作為重心參考點。

    Args:
        skeleton: shape (frames, 25, 3)
        frame: 'avg' 使用整段平均，或傳入指定 frame index
        project: 'xz' 僅保留 X,Z 分量；'none' 保留原始 XYZ

    Returns:
        np.ndarray shape (3,) 或 (2,) 的重心座標
    """
    if isinstance(frame, int):
        cog = skeleton[frame, 8]
    elif frame == 'avg':
        cog = np.mean(skeleton[:, 8], axis=0)
    else:
        raise ValueError(f"Unsupported frame value: {frame}")

    if project == 'xz':
        return np.array([cog[0], cog[2]])
    return cog


def get_relative_cg_position(skeleton: np.ndarray, frame='avg', axis='z', midhipOnly=False) -> float:
    """
    計算重心相對於腳踝中心在 XZ 平面上的偏移量（X 或 Z 軸）

    Args:
        skeleton: (frames, 25, 3)
        frame: 'avg' 或 int
        axis: 'x' or 'z'
        midhipOnly: 若為 True，僅使用 joint 8（MidHip）作為重心參考

    Returns:
        float: 正值表示偏前/右，負值表示偏後/左
    """
    if midhipOnly:
        # 改用 MidHip-only 當作重心
        if isinstance(frame, int):
            cog = skeleton[frame, 8]
        elif frame == 'avg':
            cog = np.mean(skeleton[:, 8], axis=0)
        else:
            raise ValueError(f"Unsupported frame value: {frame}")
        cg = cog[[0, 2]]  # 取 x, z
    else:
        cg = get_center_of_gravity(skeleton, frame=frame, project='xz')

    if isinstance(frame, int):
        joints = skeleton[frame]
    elif frame == 'avg':
        joints = np.mean(skeleton, axis=0)
    else:
        raise ValueError(f"Unsupported frame value: {frame}")

    foot_center_3d = (joints[11] + joints[14]) / 2
    foot_center = foot_center_3d[[0, 2]]  # 取 x, z

    axis_idx = {'x': 0, 'z': 1}[axis]  # x 對應索引 0，z 對應索引 1
    return cg[axis_idx] - foot_center[axis_idx]

def export_all_data_checkpoints_to_csv(all_analysis_results, data_names, output_csv_path):
    """
    將所有資料的分析結果（每個步驟的每個 checkpoint）整合成一份 CSV，格式類似原始 XLSX 評分表。

    Args:
        all_analysis_results (dict): dict of {data_name: analysis_result_dict}
        data_names (list): 資料名稱順序
        output_csv_path (str): 輸出 CSV 檔案路徑
    """
    rows = []
    header = ["SOP Checklist"] + data_names

    for step_name in ["Step1", "Step2", "Step3", "Step4"]:
        # rows.append([step_name])  # Step 標題列

        # 收集所有資料中該 step 的 checkpoint 名稱（照第一筆資料抓）
        checkpoints = []
        for key in all_analysis_results[data_names[0]][step_name].keys():
            if key not in ["Frechet", "Hausdorff", "Kendall's Tau", "Feedback", "IsImportant", "Score", "StepTitle", "StepDescription", "StepClassification"]:
                checkpoints.append(key)

        for cp in checkpoints:
            row = [f"cp. {cp}"]
            for data_name in data_names:
                value = str(all_analysis_results[data_name][step_name].get(cp, ""))
                if "(green)" in value or "正確" in value:
                    score_val = 1
                elif "(red)" in value or "差異過大" in value or "錯誤" in value:
                    score_val = -1
                elif "尚可接受" in value or "(yellow)" in value:
                    score_val = 0
                else:
                    score_val = 0
                row.append(score_val)
            rows.append(row)

    df = pd.DataFrame(rows, columns=header)
    df.to_csv(output_csv_path, index=False, encoding='utf-8-sig')
    print(f"📄 已輸出所有 checkpoint 分析結果至 {output_csv_path}")

def compute_per_checkpoint_accuracy(gt_csv_path, pred_csv_path):
    """
    計算每個 checkpoint 的準確率，並標記錯誤方向（高估 or 低估）。

    Returns:
        DataFrame: 每個 checkpoint 的正確數、錯誤數、準確率、錯誤偏向
    """
    gt_df = pd.read_csv(gt_csv_path).set_index("SOP Checklist")
    pred_df = pd.read_csv(pred_csv_path).set_index("SOP Checklist")

    cp_rows = [idx for idx in gt_df.index if str(idx).startswith("cp.")]
    gt_cp = gt_df.loc[cp_rows]
    pred_cp = pred_df.loc[cp_rows]
    common_cols = list(set(gt_cp.columns) & set(pred_cp.columns))

    records = []
    for cp in cp_rows:
        correct = 0
        total = 0
        over = 0  # 預測 > 標準
        under = 0  # 預測 < 標準

        over_list = []
        under_list = []

        for col in common_cols:
            gt_val = gt_cp.at[cp, col]
            pred_val = pred_cp.at[cp, col]
            if pd.isna(gt_val) or pd.isna(pred_val):
                continue
            gt_val = int(gt_val)
            pred_val = int(pred_val)

            if gt_val == pred_val:
                correct += 1
            elif pred_val > gt_val:
                over += 1
                over_list.append(col)
            elif pred_val < gt_val:
                under += 1
                under_list.append(col)
            total += 1

        accuracy = round(correct / total * 100, 1) if total > 0 else None
        bias = "分數偏高(太寬鬆)" if over > under else "分數偏低(太嚴格)" if under > over else "混合(需微調)"
        if over == 0 and under == 0:
            bias = "準確"

        records.append({
        "Checkpoint": cp,
        "Correct": correct,
        "Total": total,
        "Accuracy (%)": accuracy,
        "錯誤偏向": bias,
        "Overestimates": ", ".join(over_list),
        "Underestimates": ", ".join(under_list),
        })

    return pd.DataFrame(records)

def set_axes_equal_3d(ax, points):
    """
    強制 ax 等比例顯示，根據所有點建立立方體邊界
    """
    x = points[:, 0]
    y = points[:, 1]
    z = points[:, 2]

    x_range = x.max() - x.min()
    y_range = y.max() - y.min()
    z_range = z.max() - z.min()
    max_range = max(x_range, y_range, z_range) / 2.0

    x_center = (x.max() + x.min()) / 2
    y_center = (y.max() + y.min()) / 2
    z_center = (z.max() + z.min()) / 2

    ax.set_xlim(x_center - max_range, x_center + max_range)
    ax.set_ylim(y_center - max_range, y_center + max_range)
    ax.set_zlim(z_center - max_range, z_center + max_range)

def visualize_first_frame_with_axes(student_data, coach_data, data_name, output_dir="skeleton_vis"):
    os.makedirs(output_dir, exist_ok=True)

    fig = plt.figure()
    ax = fig.add_subplot(111, projection='3d')
    ax.set_title(f"{data_name} - First Frame Skeletons")
    ax.view_init(elev=135, azim=135)

    def draw_skeleton(points, color, label):
        for i, j in OPENPOSE_CONNECTIONS:
            if i < len(points) and j < len(points):
                x = [points[i][0], points[j][0]]
                y = [points[i][1], points[j][1]]
                z = [points[i][2], points[j][2]]
                ax.plot(x, y, z, color=color, linewidth=2, alpha=0.9)
        ax.scatter(points[:, 0], points[:, 1], points[:, 2], c=color, label=label, s=15)
        for i, (x, y, z) in enumerate(points):
            ax.text(x + 0.01, y + 0.01, z + 0.01, str(i), color='black', fontsize=8)

    student_frame = student_data[40]
    coach_frame = coach_data[40]

    draw_skeleton(student_frame, color='purple', label='Student')
    draw_skeleton(coach_frame, color='orange', label='Coach')

    # 畫簡短 RGB 軸
    origin = [0, 0, 0]
    axis_len = 1
    ax.quiver(*origin, axis_len, 0, 0, color='r')  # X 軸：紅
    ax.quiver(*origin, 0, axis_len, 0, color='g')  # Y 軸：綠
    ax.quiver(*origin, 0, 0, axis_len, color='b')  # Z 軸：藍

    # 設定等比例框架（含 Student + Coach）
    all_points = np.concatenate([student_frame, coach_frame], axis=0)
    set_axes_equal_3d(ax, all_points)

    ax.set_xlabel('X')
    ax.set_ylabel('Y')
    ax.set_zlabel('Z')
    ax.legend()

    # if data_name =='bs1353':
    #     plt.show()
    plt.savefig(f"{output_dir}/{data_name}_first_frame_skeleton.png")
    plt.close()
    print(f"✅ 已儲存骨架圖像：{output_dir}/{data_name}_first_frame_skeleton.png")


from scipy.spatial.transform import Rotation as R
import numpy as np

def align_skeleton_orientation(joints: np.ndarray) -> np.ndarray:
    """
    將 skeleton (frame, 25, 3) 對齊：
    - pelvis vector (9→12) 的 XZ 投影對齊 Z 軸
    - 若腳掌 11→22 指向 X 負向，則再繞 Y 軸旋轉 180°
    """
    aligned = joints.copy()

    # 第0幀 pelvis 向量
    pelvis_vec = aligned[0][12] - aligned[0][9]
    pelvis_proj = np.array([pelvis_vec[0], 0, pelvis_vec[2]])  # 投影到 XZ 平面
    pelvis_proj /= np.linalg.norm(pelvis_proj)

    # 目標方向：Z 軸 (0, 0, 1)
    target = np.array([0, 0, 1])
    angle = np.arccos(np.clip(np.dot(pelvis_proj, target), -1.0, 1.0))
    cross = np.cross(pelvis_proj, target)

    if cross[1] < 0:  # 方向判斷（Y 軸為旋轉軸）
        angle = -angle

    R_y = R.from_euler('y', angle).as_matrix()
    aligned = aligned @ R_y.T

    # foot direction: 11→22
    foot_vec = aligned[0][22] - aligned[0][11]
    foot_vec = foot_vec / np.linalg.norm(foot_vec)
    if foot_vec[0] < 0:  # 指向 X 負向
        R_flip = R.from_euler('y', 180, degrees=True).as_matrix()
        aligned = aligned @ R_flip.T
    
    # 平移：讓 joint[8] 的 XZ 平面位置為原點
    xz_offset = aligned[0][8].copy()
    xz_offset[1] = 0  # 保留 Y 軸不動
    aligned = aligned - xz_offset  # broadcast

    return aligned
