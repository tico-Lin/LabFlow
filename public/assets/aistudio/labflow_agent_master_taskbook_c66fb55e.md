# LabFlow 全方位實驗室科學作業系統：自主代理人終極開發任務書 (Master Agent Task Specification & TDD Acceptance Blueprint)

**文件編號**：`LF-AGENT-SPEC-2026-V4.0`  
**目標執行代理人 (Target Execution Agents)**：`Antigraity`、[OpenHands (原 OpenDevin)](https://www.openhands.dev/)、[Agent Zero](https://github.com/agent0ai/agent-zero)、[Agent S (Simular AI)](https://github.com/simular-ai/Agent-S)、[Cua (Computer-Use Agent)](https://github.com/trycua/cua)、[OpenManus](https://github.com/mannaandpoem/OpenManus)、[Open Interpreter](https://github.com/OpenInterpreter/open-interpreter)  
**開源授權條款**：`GNU General Public License v3.0 or later (GPL-3.0-or-later)`（強傳染性 Copyleft 條款）  
**核心專案雲端資產庫**：[實驗室資料處理與存處系統](https://drive.google.com/drive/folders/1LxGTN_FEV7LykOaJyRse6ZIOcjhtW-5j)（含 [LabFlow\_Pro](https://www.google.com/search?q=https://drive.google.com/drive/folders/1C2GVe2J0gO_St3ODERLF2vsX-H_kekX_)、[OriginPro85](https://drive.google.com/drive/folders/1apmjQ4DCL6Yaw7U0hyhnN1aBNdxpB1cV)、[轉檔程式設計](https://www.google.com/search?q=https://drive.google.com/drive/folders/1Mhkn8ezpO8iPNXK7dIYRV4TpOnaydYK1) 及 [2027年度國科會三年期專題研究計畫書：無氟無氯深共晶—鋁碘電池系統之開發與跨界面協同機制研究（學者完善修訂版）](https://docs.google.com/document/d/1THpMtOJWWkMvhEBo3EKmmxOUwcodIsTYOxZrCSyXgxo/edit?usp=drivesdk&ouid=110756226322385231249)）

---

## 1. 代理人全域執行鐵律與系統架構約束 (Global Agent Execution Rules & Architectural Constraints)

本任務書為直接交付予自主軟體工程代理人（Autonomous Software Engineering Agent）之最高優先級指令規範。代理人在執行任何檔案建立、重構、編譯或測試任務時，必須嚴格遵守以下十項不可妥協之工程鐵律（Non-Negotiable Engineering Invariants）：

### 1.1 嚴格測試驅動開發 (Strict Red-Green-Refactor TDD Protocol)
1. **先寫測試後寫實作**：代理人在修改或新增任何 Rust (`core-engine`)、Go (`host-service`)、Python (`src/labflow` 與 `agent-runtime`) 或 TypeScript (`ui-desktop`) 模組前，必須先在對應之 `tests/` 目錄下建立包含精確數值斷言（Numerical Assertions）與邊界條件（Edge Cases）的單元測試與整合測試。
2. **禁止無頭環境阻塞 (Headless Execution Guarantee)**：所有科學計算、圖譜渲染與視窗介面元件在執行自動化測試時，必須設定 `MPLBACKEND=Agg` 與 `QT_QPA_PLATFORM=offscreen`，嚴禁在測試執行期間彈出阻塞式 GUI 視窗（如 `plt.show()`、`QMessageBox.exec()` 或 `tkinter.Tk().mainloop()`）。
3. **禁止捏造數據與模擬樁 (Zero Mock-Data Fabrication in Production)**：正式引擎程式碼嚴禁回傳硬編碼常數或隨機亂數；所有演算法必須基於真實陣列運算（NumPy / SciPy / Rust `ndarray`）與物理定律推導。測試案例必須使用可重現之解析合成訊號（具確定性種子 `np.random.default_rng(42)`）或雲端硬碟既有實測基準數據（如 `MnOFe5Co5_20261112_*`）。

### 1.2 記憶體安全、零拷貝指標沙盒與背景計算配額 (Zero-Copy Arena & 10% Idle CPU Quota)
1. **沙盒邊界強制檢核**：凡透過 C ABI (`extern "C"`)、Python `ctypes` / `PyO3` 或 Go `cgo` 操作 [lib.rs](https://drive.google.com/file/d/1wzRZqWLOm6CsbhISNTJdC5aTmue8Jnrr/view?usp=drivesdk) 內建之 `LabFlowCore` 連續記憶體區段（Arena Buffer）時，寫入前必須呼叫 [agent.py](https://drive.google.com/file/d/1O6KAham_7eI7EHiAh8I57QUuRntQQ1U-/view?usp=drivesdk) 的 `Critic.verify_memory_bounds(ptr_address, offset, size, max_limit)`，驗證滿足：
   $$\text{ptr\_address} > 0 \quad \land \quad \text{offset} \ge 0 \quad \land \quad (\text{offset} + \text{size}) \le \text{max\_limit}$$
   若違反上述任一條件，必須立即攔截操作並回傳錯誤碼 `LABFLOW_ERR_OOB (-2)`，嚴禁觸發 Segmentation Fault 或 Undefined Behavior。
2. **背景指標對齊與虛擬映射配額 (10% Idle CPU Ceiling)**：系統背景執行緒在執行 CRDT 狀態壓縮（Compaction）、虛擬記憶體頁面對齊（Pointer Alignment）與 HDF5/NeXus 特徵張量預索引時，必須由 Go `host-service` 排程器監控系統負載，背景工作執行緒之 CPU 佔用率上限嚴格鎖定為系統閒置算力的 **10%**（透過 `runtime.GOMAXPROCS` 與 Token-Bucket 節流器控制）；一旦前台觸發即時光譜擬合或峰值檢索，背景任務必須在 $5\text{ ms}$ 內讓出執行緒。

### 1.3 物理與化學合理性強制審查器 (Physics & Chemistry Critic Gate)
代理人在實作任何光譜擬合、電化學阻抗或結構精修演算法時，輸出結果在寫入資料庫或渲染至前端畫布前，必須通過 `Critic.verify_physics(params)` 驗證：
1. **半高寬與面積正定性**：所有高斯（Gaussian）、勞倫茲（Lorentzian）、Pseudo-Voigt 與 Doniach-Šunjić 峰值之半高寬（FWHM, $\Gamma$）必須嚴格大於 $0$（$\Gamma > 10^{-9}$），且吸收或發射積分面積不得為非物理負值。
2. **Voigt 混合因子邊界**：Pseudo-Voigt 線型混合參數 $\eta$ 必須滿足 $0.0 \le \eta \le 1.0$。
3. **電化學熱力學與動力學約束**：等效串聯電阻 $R_s > 0\ \Omega$、電荷轉移電阻 $R_{ct} > 0\ \Omega$；PEIS 阻抗譜必須滿足 Kramers-Kronig 線性因果關係（全頻段相對殘差 $< 1.0\%$）；Dunn 方法分離之表面電容貢獻比例必須滿足 $0\% \le \text{Capacitive}\% \le 100\%$。
4. **繞射全反射防護 (Bragg Total Reflection Guard)**：執行同步輻射波長轉換時，若 $\frac{\lambda_2}{\lambda_1} \sin(\theta_1) > 1.0$，必須自動截斷（Filter/Clamp）超界高角度數據點並記錄警告日誌，嚴禁產生 `NaN` 破壞下游曲線插值。

### 1.4 Linux 雲端無商業字型 LaTeX 編譯鐵律 (Linux Cloud LaTeX Compilation Mandate)
所有由系統自動生成或匯出之 `.tex` 學術手稿、國科會計畫書與實驗報告範本，必須支援在無預裝商業字型的 Linux 雲端容器環境下透過 `xelatex` 或 `lualatex` 編譯，檔案標頭（Preamble）**強制包含**以下相對路徑字型與樣式設定，嚴禁改用系統絕對路徑或假設系統已安裝 Windows 字型：
```latex
\usepackage{../../_common/styles/research-setup}
\setmainfont[Path=../../_common/fonts/]{times.ttf}
\setCJKmainfont[Path=../../_common/fonts/, AutoFakeBold=true, AutoFakeSlant=true]{pmingliu.ttc}
```

### 1.5 強傳染性開源授權與端對端加密通訊 (Viral Copyleft & E2EE Security Strategy)
1. **GPL-3.0 標頭強制注入**：所有原始碼檔案頂部必須包含標準 `SPDX-License-Identifier: GPL-3.0-or-later` 標頭，確保任何衍生修改維持開源透明。
2. **透明二進位格式與 E2EE 加密同步**：本地儲存採用開放透明之 HDF5/NeXus (`.nxs`)、SQLite/PostgreSQL 與 JSON-Patch 格式；跨節點同步（NAS / Nextcloud / 遠端協作節點）時，所有 `CrdtDeltaChunk` 與實驗資產必須在客戶端先行透過 `XChaCha20-Poly1305`（金鑰由 `Argon2id` 衍生）完成端對端加密（E2EE），中繼伺服器僅負責轉發密文區塊與驗證 `Ed25519` 數位簽章。

---

## 2. 雲端硬碟既有資產與程式碼盤點映射表 (Existing Google Drive Asset & Codebase Inventory Mapping)

代理人在啟動開發前，必須完整對齊並吸收使用者雲端硬碟 [實驗室資料處理與存處系統](https://drive.google.com/drive/folders/1LxGTN_FEV7LykOaJyRse6ZIOcjhtW-5j) 內之既有程式碼、範本與計畫書，嚴禁丟失既有功能或降低演算法精確度：

| 雲端硬碟來源檔案與連結 | 既有實作內容與核心演算法特徵 | 代理人重構與整合目標路徑 | 強制保留之核心指標與行為規範 |
| :--- | :--- | :--- | :--- |
| [implementation_plan.md](https://drive.google.com/file/d/17Ikbi2sXDtfX45OU8wKa5GQwdk3A6N10/view?usp=drivesdk) | 定義 LabFlow 四層架構（L1 Rust Core、L2 Go Host、L3 Python 科學與 Agent、L4 Tauri/React UI）與 RFC 6902 差分版本控制 | `docs/ARCHITECTURE_BLUEPRINT.md` | 完整實作 L1–L4 四層分離架構，消除雙向循環依賴，落實 60 FPS 二進位狀態串流 |
| [README.md](https://drive.google.com/file/d/1DHZsY9qaOMaAMYHAp0DIitYX2Aqzzh-5/view?usp=drivesdk) & [pyproject.toml](https://drive.google.com/file/d/1qPmU1mbolCJlG0kr1y2GZT6oBFkyUAh5/view?usp=drivesdk) | 定義 `labflow` `v0.3.0-dev` 套件結構、GPL-3.0 授權、FastAPI 後端與 PyQt6/Tauri 雙模介面 | `pyproject.toml` & `README.md` | 升級為 `v4.0.0` 全功能整合版，保留 CLI 啟動入口與跨平台依賴宣告 |
| [proto/labflow.proto](https://drive.google.com/file/d/1tXd3CspytMblXNBR39KyXYyoieEyOYCO/view?usp=drivesdk) | 定義 `HostService`、`AgentService`、`CrdtOperation`、`CrdtDeltaChunk`、`SandboxWriteRequest`、`SandboxReadRequest` | `proto/labflow.proto` | 完整保留既有 RPC 定義，並擴充 `ScientificEngineService` 與 `SpectrumTensorRequest/Response` |
| [core-engine/src/lib.rs](https://drive.google.com/file/d/1wzRZqWLOm6CsbhISNTJdC5aTmue8Jnrr/view?usp=drivesdk) | 實作 PyO3 `LabFlowCore` 結構體（`base_address()`、`read_pointer()`、`write_at()` 零拷貝沙盒） | `core-engine/src/lib.rs` & `core-engine/src/c_abi.rs` | 擴充標準 C ABI (`extern "C"`) 匯出介面與執行緒安全 `RwLock` 保護 |
| [core-engine/src/crdt.rs](https://drive.google.com/file/d/13dJVbJRmQdVReXicassnn6Qo0wwfuMA2/view?usp=drivesdk) | 實作 `LamportClock`、`LamportTs`、`NodePayload` 與 9 種 `OpKind`（`InsertNode`、`UpdateNode`、`DeleteNode`、`LinkNodes`、`DeleteLink`、`DeltaMutation`、`InsertText`、`DeleteText`、`UndoOperation`） | `core-engine/src/crdt.rs` | 100% 保留 9 種 `OpKind` 與決定性 LWW (Last-Write-Wins) 衝突解決，新增快照壓縮與 Undo DAG 逆運算 |
| [core-engine/src/data_ingestion.rs](https://drive.google.com/file/d/1pTaPlZE5N4p13_0MoH-isXzyNTfb2GUe/view?usp=drivesdk) | 實作 `InstrumentFormat` 枚舉（`XRD`、`CV`、`CSV`、`TXT`、`HDF5`、`CIF`、`FITS`、`ECLab`、`XPS`）與高效解析器 | `core-engine/src/data_ingestion.rs` | 擴充支援 `NMR_FID`、`AFM_SPM`、`TGA_DSC`、`BET_BJH`、`AUDIO_WAV` 與 `TIFF_SEM` 格式自動嗅探 |
| [agent-runtime/agent.py](https://drive.google.com/file/d/1O6KAham_7eI7EHiAh8I57QUuRntQQ1U-/view?usp=drivesdk) & [analysis.py](https://drive.google.com/file/d/1A6wCXCj44l-VxZeJlueChi-kICAU-x6V/view?usp=drivesdk) | 實作 `Antigraity` 代理人 `Critic` 物理/記憶體檢核、`ToTNode` 思維樹展開與 `<Idddd` 二進位 `ChartState` 封包器 | `src/labflow/agent/antigraity_runtime.py` | 整合本地 Ollama 模型推論、GUI Computer-Use 自動化橋接與工具鏈閉環重試機制 |
| [models.py](https://drive.google.com/file/d/1QXyvD1J3enntErVG-yOLHKxXJRvB_ODo/view?usp=drivesdk) & [versioning_service.py](https://drive.google.com/file/d/1e-yIFQpney0wPfGuRSO97sF7fZ9w5o_S/view?usp=drivesdk) | 定義 `ExperimentNote`、`NoteBlock`、`NoteRevision`、`BlockType` 與 RFC 6902 `jsonpatch` + SHA-256 雜湊鏈 | `src/labflow/server/models.py` & `services/versioning_service.py` | 支援區塊級差分儲存、任意歷史版本時間旅行還原與竄改偵測驗證 |
| [baseline.py](https://drive.google.com/file/d/1SjsP0diWosSsim6inV7QuUXgk-kETgF4/view?usp=drivesdk) & [peak_fitting.py](https://drive.google.com/file/d/13lDHAms7lDR0JMUMcHcv9tC_BvfB5-oA/view?usp=drivesdk) | 實作多項式、迭代 Shirley、Tougaard、ALS 基線扣除與 Gaussian / Lorentzian / Pseudo-Voigt 多峰擬合 | `src/labflow/engines/spectroscopy_core.py` | 新增 Doniach-Šunjić 非對稱金屬峰型、自旋軌道耦合面積比約束與 AIC/BIC 峰值數量自動判定 |
| [electrochem_universal_suite_v6.py](https://drive.google.com/file/d/1qqh_0XHpVlAUu6w4KAYFh6RTNUcFJKof/view?usp=drivesdk) & [Ec_Lab_V5.py](https://drive.google.com/file/d/1tI8TjiznFbFITRsIQ_6nn-85VHPidCFv/view?usp=drivesdk) | EC-Lab v11.61 `.mpt`/`.mpr` 智慧解析、CV Dunn 動力學、Trasatti 電荷分離、GCD 積分電容與 Ragone 圖、PEIS 零交越 $R_s$/Warburg/Bode 與 LSV $iR$ 補償 Tafel | `src/labflow/engines/electrochem_engine.py` | 實測基準 `MnOFe5Co5_20261112_*` 數值誤差必須 $< 10^{-4}$（如 $R_s = 0.5192\ \Omega$、10 mV/s 電容貢獻 `74.5%`） |
| [XAS.py](https://drive.google.com/file/d/1ce70_bpDL7K3hRxVjM8t5Akz6Df1uJ27/view?usp=drivesdk) | 同步輻射 XAS 7 模型平行重網格化、局部密度先驗 AIC 動態加權與 5 通道 NeXus/HDF5 `FeatureTensor` 封裝 | `src/labflow/engines/xas_synchrotron_engine.py` | 保留 `X_Grid` Dimension Scale 綁定、7 模型平行運算與 Larch/Demeter 相容之 AUTOBK $\chi(k)$/FT $\chi(R)$ 管線 |
| [gsas_ii_to_jade_5.py](https://drive.google.com/file/d/1sf3CWWZAVl9978dQ3LBw_BmN7e8_1gId/view?usp=drivesdk) | 同步輻射 XRD 波長轉換（$\lambda = 0.77491\text{ \AA} \to \text{Cu K}\alpha\ 1.5418\text{ \AA}$）、三次樣條重採樣與二進位防呆守衛 | `src/labflow/engines/xrd_crystallography_engine.py` | 整合 PowDLL 多格式轉換、Williamson-Hall 晶粒尺寸/微應變分析與 GSAS-II / FullProf Rietveld 精修橋接 |
| [XPS拆分.py](https://drive.google.com/file/d/1umNO-SJjvVnXDXbPqMTl9U2GqEVP4Rk7/view?usp=drivesdk) | 多能區（Multi-Region）XPS 實驗數據自動偵測、清洗與獨立匯出（相容 Origin 與 CasaXPS） | `src/labflow/engines/xps_surface_engine.py` | 整合 ULVAC-PHI `.spe` 二進位/ASCII 雙模解析、$\text{C 1s} = 284.8\text{ eV}$ 荷電校正與 RSF 半定量元素表 |
| [圖片優化_V2.py](https://drive.google.com/file/d/1Xux59U58611YUKbbgUv2l85Ug35tWXhb/view?usp=drivesdk) | SEM/TEM 顯微影像標準化工作室、`SEM_STUDIO_SMART_V1` 智慧多頁 TIFF、JEOL/FEI/OCR 標尺識別與自適應對比繪製 | `src/labflow/engines/microscopy_spm_engine.py` | 保留非破壞性多頁 TIFF 封裝，並擴充 SAED 2D-FFT 選區繞射晶面標定與 AFM 三維表面粗糙度分析 |
| [OriginPro85 資料夾](https://drive.google.com/drive/folders/1apmjQ4DCL6Yaw7U0hyhnN1aBNdxpB1cV) | 包含 `.otp` 圖譜範本（[PPNormal.otp](https://drive.google.com/file/d/13dWEnjUtsGMgN74Z1tbsTMKummvUFdI5/view?usp=drivesdk)、[PPExp.otp](https://drive.google.com/file/d/1ZppmbYsqPfbTBIPrEjXfLcTMTitF9Z03/view?usp=drivesdk)、[ReportFit.otp](https://drive.google.com/file/d/1KXdBf6XJV329VXV0iabJKkmdn5p-9hhu/view?usp=drivesdk)、[ReportPartial.otp](https://drive.google.com/file/d/1MJ-eTOc4dmdr5X709Wonif3YYJG8E2f4/view?usp=drivesdk)、[RIBBON.otp](https://drive.google.com/file/d/1FFSV2X2HCtx8NOfhuDEj6WQrKMYPmc6B/view?usp=drivesdk)）、`FitFunc` (`.fdf`) 與 `OriginC` | `src/labflow/engines/origin_compat_engine.py` | 實作 `.fdf` 函數解析器（將 Origin `[Formula]` 編譯為 SciPy 可呼叫核函數）與 `.otp` 視覺主題映射器 |
| [2027年度國科會三年期專題研究計畫書](https://docs.google.com/document/d/1THpMtOJWWkMvhEBo3EKmmxOUwcodIsTYOxZrCSyXgxo/edit?usp=drivesdk&ouid=110756226322385231249) | 無氟無氯深共晶—鋁碘電池系統（`Al-I2`）與 `MIL-100(Fe)` 宿主水熱合成、跨界面協同機制與原位光譜表徵規劃 | `templates/nstc_al_i2_workflow.json` | 預置三年期計畫之實驗 SOP、藥品庫存追蹤、原位 Raman/XAS/XPS 對照表與電池循環壽命自動評估模板 |

---

## 3. 全系統目標儲存庫目錄結構與職責邊界 (Target Monorepo Directory Structure & Module Boundaries)

代理人必須在專案根目錄建立並維護以下標準化多語言 Monorepo 結構，嚴格遵守各層級之職責邊界（L4 僅負責渲染與互動，嚴禁在前端執行重度數值擬合；L1 僅負責記憶體、CRDT 與高速解析，嚴禁包含業務邏輯或網路連線）：

```text
LabFlow_Ultimate_System/
├── Cargo.toml                                  # Rust Workspace 根設定檔
├── pyproject.toml                              # Python PEP 621 專案設定 (GPL-3.0-or-later)
├── go.mod                                      # Go 1.22+ 模組設定檔
├── package.json                                # Node/Tauri/React 工作區設定檔
├── proto/
│   └── labflow.proto                           # gRPC 服務與 Protobuf 訊息唯一真實來源 (SSOT)
├── include/
│   └── labflow_c_abi.h                         # 標準 C99/C++ ABI 標頭檔 (供 ctypes/cgo/外部儀器 SDK 呼叫)
├── core-engine/                                # [L1 核心計算與同步層 - Rust]
│   ├── Cargo.toml                              # 設定 crate-type = ["cdylib", "rlib"]
│   └── src/
│       ├── lib.rs                              # PyO3 Python 綁定入口與零拷貝記憶體池 (Arena)
│       ├── c_abi.rs                            # extern "C" 標準 C ABI 匯出函數與邊界防呆
│       ├── crdt.rs                             # Lamport 時鐘、9 種 OpKind CRDT 狀態機與快照壓縮
│       ├── crypto_e2ee.rs                      # XChaCha20-Poly1305 加密、Argon2id 與 Ed25519 簽章
│       └── data_ingestion.rs                   # SIMD 加速多格式儀器數據解析與波長轉換核函數
├── host-service/                               # [L2 主機通訊與儲存調度層 - Go]
│   ├── main.go                                 # gRPC Server (:50051)、REST Gateway (:8080) 與 WS Hub (:8081)
│   ├── cgo_bridge.go                           # 透過 cgo 呼叫 libcore_engine.so 之零拷貝橋接器
│   ├── idle_scheduler.go                       # 10% 閒置 CPU 背景指標對齊、ZFS 快照與 CRDT 壓縮排程器
│   └── storage_pg_nexus.go                     # PostgreSQL JSONB/pgvector 與 HDF5/NeXus 雙寫交易協調器
├── src/
│   └── labflow/                                # [L3 科學分析引擎與 API 服務層 - Python]
│       ├── __init__.py
│       ├── server/
│       │   ├── main.py                         # FastAPI OpenAPI 3.1 伺服器與 WebSocket 雙向串流端點
│       │   ├── models.py                       # SQLAlchemy 2.0 ORM 模型 (ExperimentNote, Sample, Reagent 等)
│       │   ├── schemas.py                      # Pydantic v2 嚴格型別驗證 Schema
│       │   └── services/
│       │       ├── note_service.py             # 區塊級筆記 CRUD 與雙向 WikiLink 解析
│       │       ├── versioning_service.py       # RFC 6902 JSON-Patch 差分計算與 SHA-256 雜湊鏈驗證
│       │       └── lims_inventory_service.py   # SENAITE/openBIS 樣品譜系 DAG 與藥品安全庫存預警
│       ├── engines/
│       │   ├── spreadsheet_grist_engine.py     # Category 1: 反應式試算表、Python 欄位公式與 Origin .fdf/.otp 相容層
│       │   ├── document_latex_engine.py        # Category 2, 5, 8: LibreOffice/Stirling-PDF 處理與 Linux LaTeX 編譯器
│       │   ├── dms_paperless_engine.py         # Category 3: Nextcloud WebDAV 同步與 Paperless-ngx COA/發票 OCR
│       │   ├── chem_structure_engine.py        # Category 6: Ketcher SMILES/MOL 解析、計量學計算與 Avogadro 3D 座標生成
│       │   ├── zotero_starmap_engine.py        # Category 7: Zotero BibTeX/DOI 同步與 Obsidian 知識星圖力導向佈局
│       │   ├── poster_veusz_engine.py          # Category 9: 出版級多面板組合圖 (600 DPI) 與 Inkscape SVG 向量匯出
│       │   ├── acoustic_speech_engine.py       # Category 10: Praat F0/Formant F1-F4、openSMILE eGeMAPS 與超音波空化監測
│       │   ├── ai_ml_pipeline_engine.py        # Category 11: Ollama 本地推論、RAG 向量檢索、ComfyUI DAG 與 PINN 擬合
│       │   ├── electrochem_engine.py           # Category 14.A: EC-Lab .mpt/.mpr、CV Dunn/Trasatti、GCD 積分電容、PEIS/Tafel
│       │   ├── xrd_crystallography_engine.py   # Category 14.B: 同步輻射波長轉換、PowDLL、Williamson-Hall 與 Rietveld 精修
│       │   ├── xas_synchrotron_engine.py       # Category 14.C: 7 模型平行重網格化、局部密度 AIC 加權、AUTOBK 與 EXAFS FT
│       │   ├── xps_surface_engine.py           # Category 14.D: 多能區拆分、Shirley/Tougaard 背景、Doniach-Šunjić 與 RSF 定量
│       │   ├── nmr_spectroscopy_engine.py      # Category 14.E: FID 窗函數、零填充 FFT、熵最小化相位校正與多重峰積分
│       │   ├── microscopy_spm_engine.py        # Category 14.F: SEM_STUDIO_SMART_V1 多頁 TIFF、SAED 2D-FFT 與 AFM 粗糙度
│       │   └── thermal_porosity_pls_engine.py  # Category 14.G: TGA Kissinger、BET/BJH 孔隙、Kaomi 流變與 NIPALS PLS-SEM
│       └── agent/
│           ├── antigraity_runtime.py           # Category 12: Antigraity ToT 思維樹、Critic 物理/記憶體守衛與 gRPC 服務
│           └── computer_use_bridge.py          # Cua / Agent S 舊版科學軟體 (Jade/CasaXPS/Origin) 視窗自動化橋接器
├── ui-desktop/                                 # [L4 跨平台桌面與網頁前端層 - Tauri v2 + React 18 + TypeScript]
│   ├── src-tauri/                              # Tauri Rust 宿主配置與系統原生選單/檔案對話框
│   └── src/
│       ├── App.tsx                             # 整合式工作台主路由 (/dashboard, /notes, /workbench, /graph, /lims, /agent)
│       ├── components/
│       │   ├── SpreadsheetGrid.tsx             # Grist/Origin 風格雙層標頭 (Long Name/Units/Sparkline/Formula) 反應式表格
│       │   ├── SpectrumCanvasWebGL.tsx         # 60 FPS WebGL 二進位 ChartState 即時光譜與分峰互動畫布
│       │   ├── StarMapForceGraph.tsx           # Zotero + Obsidian + eLabFTW 知識星圖 2D/3D 互動檢視器
│       │   ├── KetcherAvogadroPanel.tsx        # 2D 化學結構繪製與 3D 晶體/配位結構檢視面板
│       │   └── AntigraityCopilotDock.tsx       # 思維樹 (ToT) 視覺化追蹤與自然語言實驗分析助手
├── templates/
│   ├── latex/
│   │   └── research_manuscript_template.tex    # 內建相對路徑 times.ttf / pmingliu.ttc 與 research-setup 之標準範本
│   ├── origin_otp/                             # 映射自雲端硬碟 OriginPro85 之圖譜樣式定義檔
│   └── workflows/
│       └── nstc_2027_al_i2_battery.json        # 2027 國科會無氟無氯深共晶鋁碘電池與 Cr-MnO2@Ni foam 標準實驗流程
├── deploy/                                     # [Category 13: 雲端與儲存基礎設施部署配置]
│   ├── docker-compose.production.yml           # 全棧微服務容器編排 (PostgreSQL+pgvector, Redis, Go Host, Python L3, LocalAI)
│   ├── proxmox_zfs_provision.sh                # Proxmox VE LXC/KVM 建立與 TrueNAS SCALE ZFS 資料集自動掛載腳本
│   └── nginx_grpc_ws_gateway.conf              # 支援 HTTP/2 gRPC、WebSocket 升級與 TLS 1.3 之反向代理配置
└── tests/                                      # [全系統 TDD 自動化驗收測試套件]
    ├── test_c_abi_and_ffi_zerocopy.py          # 驗證 C ABI 與 PyO3 零拷貝指標邊界與吞吐量
    ├── test_crdt_and_versioning.py             # 驗證 Lamport CRDT 收斂性、RFC 6902 JSON-Patch 與 SHA-256 雜湊鏈
    ├── test_electrochem_suite_v6.py            # 驗證 CV Dunn/Trasatti、GCD 積分電容、PEIS 零交越 Rs 與 Tafel 補償
    ├── test_xas_xrd_xps_nmr.py                 # 驗證 XAS 7 模型 AIC、XRD 波長轉換、XPS Shirley/Voigt 與 NMR FFT
    ├── test_sem_afm_thermal_bet_pls.py         # 驗證 SEM 多頁 TIFF、SAED FFT、AFM Ra/Rq、BET/BJH 與 PLS-SEM
    └── test_acoustic_agent_and_protocols.py    # 驗證 Praat/openSMILE 特徵、Antigraity Critic 攔截與 gRPC/WS/REST 端點
```

---

## 4. 五大跨語言呼叫協定規範：詳細規則、實作作法與驗收條件 (5 Cross-Language Invocation Protocols)

本系統強制支援五種跨語言呼叫協定，供內部微服務、外部腳本（Python / R / Julia / MATLAB）及實驗室硬體控制程式（C / C++ / LabVIEW）無縫呼叫：

### 4.1 協定一：C ABI (`extern "C"` 標準二進位介面)
* **詳細規則**：
  1. 所有匯出函數必須標註 `#[no_mangle] pub extern "C" fn`，且嚴禁讓 Rust `panic!` 跨越 FFI 邊界（所有內部邏輯必須封裝於 `std::panic::catch_unwind` 中，若發生異常則回傳負數錯誤碼）。
  2. 所有跨語言傳遞之結構體必須標註 `#[repr(C)]`，欄位順序與型別寬度（`uint64_t`、`int32_t`、`double`、`const uint8_t*`）必須與 `include/labflow_c_abi.h` 完全一致。
  3. 記憶體所有權規則：由 `labflow_arena_create(capacity_bytes)` 配置之指標必須由呼叫端透過 `labflow_arena_destroy(handle)` 顯式釋放，嚴禁呼叫端直接使用 C `free()` 釋放 Rust 配置之記憶體。
* **實作作法**：
  於 `include/labflow_c_abi.h` 與 `core-engine/src/c_abi.rs` 實作以下核心簽章：
  ```c
  // SPDX-License-Identifier: GPL-3.0-or-later
  #ifndef LABFLOW_C_ABI_H
  #define LABFLOW_C_ABI_H
  #include <stdint.h>
  #include <stddef.h>

  #ifdef __cplusplus
  extern "C" {
  #endif

  typedef struct LabFlowArenaHandle LabFlowArenaHandle;

  typedef struct {
      int32_t status_code;       // 0 = OK, -1 = NULL_PTR, -2 = OUT_OF_BOUNDS, -3 = MATH_DOMAIN_ERR
      uint64_t lamport_ts;       // 運算後更新之 Lamport 邏輯時戳
      size_t valid_count;        // 實際有效輸出元素數量
      double primary_metric;     // 主指標 (如 Rs, AIC_min, R_wp)
  } LabFlowStatusFFI;

  LabFlowArenaHandle* labflow_arena_create(size_t capacity_bytes);
  void labflow_arena_destroy(LabFlowArenaHandle* handle);
  uintptr_t labflow_arena_base_ptr(const LabFlowArenaHandle* handle);
  int32_t labflow_arena_write(LabFlowArenaHandle* handle, size_t offset, const uint8_t* src, size_t len);
  int32_t labflow_arena_read(const LabFlowArenaHandle* handle, size_t offset, uint8_t* dst, size_t len);

  LabFlowStatusFFI labflow_xrd_bragg_convert(
      const double* two_theta_in,
      const double* intensity_in,
      size_t n_points,
      double lambda_src_angstrom,
      double lambda_dst_angstrom,
      double* two_theta_out,
      double* intensity_out
  );

  #ifdef __cplusplus
  }
  #endif
  #endif
  ```
* **驗收條件 (Acceptance Criteria)**：
  - **AC-ABI-01**：使用 `gcc -Wall -Wextra -Werror` 編譯 C 測試程式並連結 `libcore_engine.so`，傳入 `offset + len > capacity_bytes` 時，必須回傳 `-2` (`LABFLOW_ERR_OOB`) 且進程不崩潰（Valgrind 檢查 `0 errors from 0 contexts`）。
  - **AC-ABI-02**：呼叫 `labflow_xrd_bragg_convert` 轉換 $\lambda_1 = 0.77491\text{ \AA} \to \lambda_2 = 1.5418\text{ \AA}$ 之測試陣列，輸出角度與 Python 參考解之最大絕對誤差 $\max|\Delta(2\theta)| < 10^{-12}\text{ deg}$。

### 4.2 協定二：FFI (PyO3 / Python `ctypes` / Go `cgo` 零拷貝共享記憶體橋接)
* **詳細規則**：
  1. 在 [core-engine/src/lib.rs](https://drive.google.com/file/d/1wzRZqWLOm6CsbhISNTJdC5aTmue8Jnrr/view?usp=drivesdk) 既有 `LabFlowCore` (`base_address`, `read_pointer`, `write_at`) 基礎上，實作零拷貝 NumPy Buffer Protocol 與 Apache Arrow C Data Interface (`ArrowArray` / `ArrowSchema`)。
  2. Python 層讀取大尺寸光譜張量（如 $10^6$ 點時間序列或高解析 2D EELS/XAS 矩陣）時，必須直接透過 `ctypes.cast(base_addr + offset, ctypes.POINTER(ctypes.c_double))` 搭配 `np.ctypeslib.as_array` 建立零拷貝視圖（Zero-Copy View），嚴禁將整個陣列序列化為 JSON 字串。
* **實作作法**：
  1. 在 [agent.py](https://drive.google.com/file/d/1O6KAham_7eI7EHiAh8I57QUuRntQQ1U-/view?usp=drivesdk) 與 `src/labflow/engines/ffi_bridge.py` 中封裝 `ZeroCopyArenaBridge` 類別，自動根據作業系統載入 `libcore_engine.so` (Linux)、`libcore_engine.dylib` (macOS) 或 `core_engine.dll` (Windows)。
  2. 所有寫入操作前強制呼叫 `Critic.verify_memory_bounds(ptr_address, offset, size, max_limit)`。
* **驗收條件 (Acceptance Criteria)**：
  - **AC-FFI-01**：在 Python 與 Rust 間傳遞 $1,000,000$ 個 `float64`（$8\text{ MB}$）光譜數據點，零拷貝指標映射耗時必須 $< 0.5\text{ ms}$，且透過 `np.shares_memory()` 驗證底層記憶體位址與 `base_address() + offset` 完全相同。
  - **AC-FFI-02**：當 `offset < 0` 或 `offset + size > max_limit` 時，`Critic.verify_memory_bounds` 必須回傳 `False` 並拋出 `MemoryBoundaryViolationError`。

### 4.3 協定三：gRPC (`HTTP/2 + Protocol Buffers v3`)
* **詳細規則**：
  1. 以雲端硬碟既有 [proto/labflow.proto](https://drive.google.com/file/d/1tXd3CspytMblXNBR39KyXYyoieEyOYCO/view?usp=drivesdk) 為基礎，完整保留 `HostService`（`StreamCrdtEvents`、`WriteSandboxMemory`、`ReadSandboxMemory`）與 `AgentService`（`ExecuteTask`、`AnalyzeDataStream`），並擴充 `ScientificEngineService`。
  2. 所有 gRPC 串流必須啟用 `gzip` / `zstd` 壓縮與 Keepalive 探測（每 $30\text{ s}$ 發送一次 ping），單一訊息上限設定為 $64\text{ MB}$ 以支援高維度 HDF5 張量區塊傳輸。
* **實作作法**：
  於 `proto/labflow.proto` 定義完整協定並透過 `protoc` 生成 Go (`host-service/pb`)、Python (`src/labflow/proto`) 與 TypeScript (`ui-desktop/src/proto`) 程式碼：
  ```protobuf
  syntax = "proto3";
  package labflow;
  option go_package = "labflow/host-service/pb";

  service HostService {
    rpc StreamCrdtEvents (stream CrdtDeltaChunk) returns (stream CrdtDeltaChunk);
    rpc WriteSandboxMemory (SandboxWriteRequest) returns (SandboxWriteResponse);
    rpc ReadSandboxMemory (SandboxReadRequest) returns (SandboxReadResponse);
  }

  service AgentService {
    rpc ExecuteTask (TaskRequest) returns (stream TaskProgressResponse);
    rpc AnalyzeDataStream (DataAnalysisRequest) returns (DataAnalysisResponse);
  }

  service ScientificEngineService {
    rpc RunElectrochemSuite (ElectrochemRequest) returns (ElectrochemResponse);
    rpc RunXasTensorRegrid (XasRegridRequest) returns (XasRegridResponse);
    rpc RunXrdWavelengthConvert (XrdConvertRequest) returns (XrdConvertResponse);
    rpc RunXpsMultiRegionSplit (XpsSplitRequest) returns (XpsSplitResponse);
  }
  ```
* **驗收條件 (Acceptance Criteria)**：
  - **AC-GRPC-01**：啟動 Go `HostService` 與 Python `AgentService` 後，透過 `StreamCrdtEvents` 雙向串流並發傳送 $1,000$ 筆 `CrdtDeltaChunk`，所有節點之 Lamport 時鐘與 CRDT 狀態樹必須 100% 收斂一致，P99 延遲 $< 10\text{ ms}$。
  - **AC-GRPC-02**：當 `AnalyzeDataStream` 接收到之擬合參數包含負值 FWHM（如 `fwhm = -0.5`）時，伺服器必須觸發 `Critic.verify_physics` 攔截並回傳 `success = false` 與詳細物理違規原因。

### 4.4 協定四：WebSocket (`RFC 6455` 二進位與 JSON 雙模即時串流)
* **詳細規則**：
  1. WebSocket 端點 `/ws/v1/stream` 必須同時支援 **Text Frame (UTF-8 JSON)**（用於傳遞 CRDT 文字編輯與系統通知）與 **Binary Frame (Raw Little-Endian Struct)**（用於 60 FPS 即時光譜動畫與儀器即時採集串流）。
  2. 二進位圖譜狀態封包必須嚴格遵循 [analysis.py](https://drive.google.com/file/d/1A6wCXCj44l-VxZeJlueChi-kICAU-x6V/view?usp=drivesdk) 定義之 `struct.pack("<Idddd", series_id, x_min, x_max, y_min, y_max)` 36-byte Header 緊接 `N * 8` bytes `float64` 數據負載格式。
* **實作作法**：
  在 Python FastAPI (`src/labflow/server/main.py`) 與 Go (`host-service/main.go`) 實作具備 Backpressure 緩衝佇列（容量 256 幀，超載時自動丟棄過期中間視覺幀但絕對保留所有 CRDT 狀態幀）之 WebSocket Hub。
* **驗收條件 (Acceptance Criteria)**：
  - **AC-WS-01**：連續發送 600 幀含 $4,096$ 點 `float64` 之二進位 `ChartState` 封包，前端 `DataView` 解包後之 `(series_id, x_min, x_max, y_min, y_max)` 與尾隨陣列數值必須與發送端完全一致（位元級零誤差），平均每幀傳輸與解碼時間 $< 8\text{ ms}$（確保 $\ge 60\text{ FPS}$）。

### 4.5 協定五：RESTful API (`HTTP + JSON` OpenAPI 3.1 標準介面)
* **詳細規則**：
  1. 所有 RESTful 端點必須掛載於 `/api/v1/` 命名空間下，使用 Pydantic v2 強制驗證輸入與輸出 Schema，並自動生成 `/openapi.json` 與 `/docs` 互動式規格文件。
  2. 所有錯誤回應必須遵循 **RFC 7807 Problem Details for HTTP APIs** 標準格式（包含 `type`、`title`、`status`、`detail`、`instance` 與 `trace_id` 欄位）。
* **實作作法與端點清單**：

| HTTP 方法與路徑 | 功能描述 | 請求 Payload 關鍵欄位 | 驗收狀態碼與回應驗證條件 |
| :--- | :--- | :--- | :--- |
| `POST /api/v1/notes` | 建立新實驗記錄本與初始區塊 | `title`, `blocks[]` (`markdown`, `code`, `chart`, `chem`) | 回傳 `201 Created`，含初始 `NoteRevision` (`revision_number=1`, 64 字元 `commit_hash`) |
| `PATCH /api/v1/notes/{id}` | 提交區塊更新並計算 RFC 6902 差分 | `blocks[]`, `author_id`, `parent_hash` | 回傳 `200 OK`，`patch_json` 為合法 RFC 6902 JSON-Patch 陣列，且 `verify_integrity` 為 `true` |
| `POST /api/v1/electrochem/analyze` | 執行 CV / GCD / PEIS / LSV / 感測器全套分析 | `technique`, `raw_text` 或 `arrays`, `mass_mg` | 回傳 `200 OK`，包含完整動力學 $b$ 值、Dunn 電容比例、積分電容 $C_{\text{int}}$、$R_s$ 與 Tafel 斜率 |
| `POST /api/v1/xas/regrid-tensor` | 執行同步輻射 XAS 7 模型平行重網格與 AIC 融合 | `energy_ev[]`, `mu_raw[]`, `export_nexus_h5` | 回傳 `200 OK`，含 7 模型預測值、`aic_weights` ($\sum w_i = 1.0$)、融合光譜與 `.nxs` 下載代碼 |
| `POST /api/v1/xrd/convert` | 執行同步輻射波長轉換與 Williamson-Hall 分析 | `two_theta[]`, `intensity[]`, `lambda_src`, `lambda_dst` | 回傳 `200 OK`，含轉換後 Cu K$\alpha$ 角度、三次樣條重採樣曲線與全反射截斷點數報告 |
| `POST /api/v1/xps/deconvolve` | 執行多能區拆分、Shirley 基線與 Voigt 分峰 | `binding_energy[]`, `counts[]`, `c1s_ref_ev`, `n_peaks` | 回傳 `200 OK`，含荷電校正平移量、Shirley 基線、各子峰中心/FWHM/面積比與原子百分比 |
| `POST /api/v1/nmr/process-fid` | 執行 NMR FID 窗函數、FFT、相位與多重峰積分 | `fid_real[]`, `fid_imag[]`, `sw_hz`, `sfo1_mhz`, `lb_hz` | 回傳 `200 OK`，含化學位移 `ppm[]`、相位校正後吸收譜與各多重峰積分面積比 |
| `POST /api/v1/sem-spm/standardize` | 執行 SEM 智慧標尺嵌入、SAED FFT 與 AFM 粗糙度 | `image_b64` 或 `height_matrix[][]`, `pixel_size_nm` | 回傳 `200 OK`，含 `SEM_STUDIO_SMART_V1` 多頁 TIFF 標記、晶面間距 $d_{hkl}$ 與 $R_a, R_q$ |
| `POST /api/v1/thermal-porosity/analyze` | 執行 TGA Kissinger、BET/BJH 孔隙與 PLS-SEM 模型 | `mode` (`tga`/`bet`/`rheology`/`pls_sem`), `dataset` | 回傳 `200 OK`，含活化能 $E_a$、BET 比表面積 $S_{\text{BET}}$ ($R^2 > 0.999$) 或 PLS 路徑係數 |
| `POST /api/v1/audio/extract-features` | 執行 Praat 基頻/共振峰與 openSMILE 聲學特徵提取 | `pcm_samples[]`, `sample_rate_hz` | 回傳 `200 OK`，含 $F_0$、共振峰 $F_1$–$F_4$、Jitter、Shimmer、HNR 與 13 階 MFCC |

---

## 5. 十四大領域子系統逐項任務規範：詳細規則、實作作法與驗收條件 (14 Domain Subsystems Specification)

代理人必須針對使用者指定之 14 大參考軟體領域，逐一落實以下演算法細節與驗收標準：

---

### 5.1 領域一：表格類算法與互動式科學試算表引擎 (Spreadsheet & Tabular Algorithms)
* **參考軟體對標**：[OriginPro85](https://drive.google.com/drive/folders/1apmjQ4DCL6Yaw7U0hyhnN1aBNdxpB1cV)、[Grist (`grist-core`)](https://github.com/gristlabs/grist-core)、[LibreOffice Calc](https://www.libreoffice.org/discover/calc/)、[SciDAVis](https://scidavis.sourceforge.net/)、[JupyterLab](https://jupyterlab.readthedocs.io/)。
* **詳細規則**：
  1. 試算表嚴禁僅提供單一列文字標頭；必須實作 **Origin 多層屬性標頭（Multi-Tier Column Header）**，每一欄（Column）必須包含：`Long Name`（長名稱，如 `Working Electrode Potential`）、`Units`（單位，如 `V vs. Ag/AgCl`）、`Comments`（實驗條件備註）、`Axis Role`（座標軸角色：`X`、`Y`、`Z`、`yEr±`、`xEr±`、`Label`）以及 `Sparkline`（迷你趨勢預覽圖）。
  2. 公式引擎必須同時支援 **LibreOffice Calc 儲存格語法**（如 `=AVERAGE(B2:B101)`、`=STDEV.S(C2:C101)`）與 **Grist 整欄式 Python 向量表達式**（如在欄位 `D` 設定公式 `np.gradient($C, $A)` 或 `scipy.signal.savgol_filter($B, 11, 3)`，其中 `$A`、`$B`、`$C` 直接映射為底層 `float64` NumPy 向量）。
  3. 必須相容雲端硬碟 [OriginPro85](https://drive.google.com/drive/folders/1apmjQ4DCL6Yaw7U0hyhnN1aBNdxpB1cV) 內之 `.fdf` 擬合函數定義檔（`FitFunc`）與 `.otp` 圖譜範本（[PPNormal.otp](https://drive.google.com/file/d/13dWEnjUtsGMgN74Z1tbsTMKummvUFdI5/view?usp=drivesdk)、[PPExp.otp](https://drive.google.com/file/d/1ZppmbYsqPfbTBIPrEjXfLcTMTitF9Z03/view?usp=drivesdk)、[ReportFit.otp](https://drive.google.com/file/d/1KXdBf6XJV329VXV0iabJKkmdn5p-9hhu/view?usp=drivesdk)、[ReportPartial.otp](https://drive.google.com/file/d/1MJ-eTOc4dmdr5X709Wonif3YYJG8E2f4/view?usp=drivesdk)、[RIBBON.otp](https://drive.google.com/file/d/1FFSV2X2HCtx8NOfhuDEj6WQrKMYPmc6B/view?usp=drivesdk)）。
* **實作作法**：
  1. 於 `src/labflow/engines/spreadsheet_grist_engine.py` 建立 `ReactiveColumnGraph`（有向無環相依圖 DAG）：當欄位 `A` 的任一列數值更新時，透過拓撲排序（Topological Sort）自動重算所有相依衍生欄（如 `C`、`D`），若偵測到循環參照（如 `A = $B + 1` 且 `B = $A + 1`），立即拋出 `CircularFormulaDependencyError`。
  2. 實作 `OriginFdfParser`：讀取 `.fdf` 檔案中的 `[Parameters]`、`[Independent Variables]`、`[Dependent Variables]` 與 `[Formula]` 區段，透過 AST 安全沙盒轉譯為 `scipy.optimize.curve_fit` 可執行之 Python 函數。
  3. 實作 JupyterLab `.ipynb` 雙向匯出器：一鍵將試算表數據與所選擬合演算法匯出為含完整 Markdown 說明與可重現程式碼儲存格之 `.ipynb` 檔案。
* **驗收條件 (Acceptance Criteria)**：
  - **AC-TAB-01**：建立含 $10,000$ 列之試算表，設定 `Col_A = np.linspace(0, 10, 10000)`、`Col_B = np.sin($Col_A)`、`Col_C = np.gradient($Col_B, $Col_A)`，修改 `Col_A[0]` 後，DAG 自動重算完成時間必須 $< 15\text{ ms}$，且 `Col_C` 與 $\cos(\text{Col\_A})$ 之均方根誤差 $\text{RMSE} < 10^{-5}$。
  - **AC-TAB-02**：解析 Origin `.fdf` 檔案（含 Gaussian、Boltzmann、Allometric1 模型）並執行非線性最小平方法（Levenberg-Marquardt）擬合，收斂參數標準誤差與決定係數 $R^2$（Adjusted $R^2$、Reduced $\chi^2$）計算結果與標準值誤差 $< 10^{-6}$。

---

### 5.2 領域二：科學文件、簡報與向量繪圖引擎 (Docs, Presentations & Vector Graphics)
* **參考軟體對標**：[LibreOffice](https://www.libreoffice.org/)、[LabPlot](https://labplot.kde.org/)、[JupyterLab](https://jupyterlab.readthedocs.io/)、[Inkscape](https://inkscape.org/)。
* **詳細規則**：
  1. 完整實作雲端硬碟 [models.py](https://drive.google.com/file/d/1QXyvD1J3enntErVG-yOLHKxXJRvB_ODo/view?usp=drivesdk) 定義之區塊化筆記模型（`ExperimentNote`、`NoteBlock`、`NoteRevision`），區塊型別（`BlockType`）必須涵蓋：`markdown`、`latex_math`、`code_cell`、`live_chart`、`spreadsheet_embed`、`chem_sketch` 與 `slide_deck`。
  2. 完整實作 [versioning_service.py](https://drive.google.com/file/d/1e-yIFQpney0wPfGuRSO97sF7fZ9w5o_S/view?usp=drivesdk) 之 **RFC 6902 JSON-Patch 差分版本控制與 SHA-256 防竄改雜湊鏈**：每次儲存修訂版時，僅儲存相對於上一版之 `jsonpatch.make_patch(prev_snapshot, curr_snapshot)`，並計算：
     $$H_n = \text{SHA256}\big(\text{UTF8}(H_{n-1} \parallel \text{canonical\_json}(S_n))\big)$$
* **實作作法**：
  1. 整合 Headless LibreOffice 轉換管線（強制配置獨立暫存設定檔 `-env:UserInstallation=file:///tmp/lo_profile_<pid>` 與 `HOME=/tmp` 及 45 秒逾時保護），支援將實驗報告匯出為 `.docx`、`.odt`、`.pptx` 與 `.pdf`。
  2. 實作 Inkscape 相容之純向量 SVG 圖層產生器，確保所有圖譜軸線、刻度、圖例與數學符號皆以獨立 `<g id="layer_...">` 群組匯出，方便研究人員進行海報級微調。
* **驗收條件 (Acceptance Criteria)**：
  - **AC-DOC-01**：對同一份 `ExperimentNote` 連續執行 20 次區塊新增、修改與刪除，呼叫 `reconstruct_snapshot(revisions, target_rev=k)` 還原第 $k$ 版快照時，還原結果與當時真實狀態必須 100% 相等；若手動竄改第 10 版之 `patch_json` 任一字元，`verify_integrity()` 必須立即回傳 `False`。

---

### 5.3 領域三：智慧文件管理與 OCR 歸檔系統 (Document Management & DMS)
* **參考軟體對標**：[Nextcloud](https://www.truenas.com/docs/core/solutions/integrations/nextcloud/)、[Paperless-ngx](https://github.com/paperless-ngx/paperless-ngx/discussions/13645)、[Alfresco Community Edition](https://www.alfresco.com/)。
* **詳細規則**：
  1. 實驗室所有採購發票、報價單、藥品檢驗報告（COA, Certificate of Analysis）、物質安全資料表（SDS/MSDS）與貴重儀器預約單（如國科會貴儀中心 SEM/TEM/XPS 預約單、國家同步輻射研究中心 NSRRC 光束線申請書）必須納入統一內容定址儲存庫（Content-Addressable Storage, CAS）。
  2. 自動化解析規則必須針對實驗室常用供應商（如 **友和貿易 Uni-Onward**、**洛科儀器 Rocker Scientific**、**科研市集 Sciket**）之單據格式自動提取：供應商名稱、統一編號、品名、CAS Number、批號（Lot No.）、純度、金額與保存期限。
* **實作作法**：
  1. 於 `src/labflow/engines/dms_paperless_engine.py` 實作 `DocumentIngestionPipeline`：計算檔案 SHA-256 雜湊值作為唯一識別碼（防止重複歸檔），提取文字層並執行正則表達式與本地 LLM 實體識別（NER），自動掛載分類標籤（Tags）並連動更新 LIMS 藥品庫存表。
  2. 實作 WebDAV 雙向同步客戶端，支援與自建 Nextcloud Hub 自動備份。
* **驗收條件 (Acceptance Criteria)**：
  - **AC-DMS-01**：投入含 CAS Number（如氯化鋁 `7446-70-0`、尿素 `57-13-6`、硝酸鐵九水合物 `7782-61-8`）與供應商資訊之測試 COA/報價單文件，系統必須在 $500\text{ ms}$ 內完成 SHA-256 去重檢核，並準確解析出 `cas_number`、`vendor`、`lot_number` 與 `purity_pct` 欄位（準確率 100%）。

---

### 5.4 領域四：資料庫、電子實驗記錄本與實驗室資訊管理系統 (Database, ELN & LIMS)
* **參考軟體對標**：[PostgreSQL](https://www.postgresql.org/)、[eLabFTW](https://www.elabftw.net/)、[NocoDB](https://github.com/nocodb/nocodb)、[Baserow](https://baserow.io/)、[SENAITE](https://www.senaite.com/)、[openBIS](https://openbis.ch/)。
* **詳細規則**：
  1. 關聯式資料庫採用 **PostgreSQL 16 + `pgvector` + `JSONB`**，離線單機模式自動降級為 **SQLite 3 (WAL 模式)**，確保架構與 ORM 查詢 100% 相容。
  2. 必須實作 **openBIS / SENAITE 樣品生命週期有向無環圖（Sample Lineage DAG）**：每一件實驗樣品（Sample）必須具備全域唯一條碼/QR Code 識別碼（如 `LF-20261114-ALI2-001`），並嚴格記錄其父節點（前驅物藥品 `Reagent` 與基底材料如碳布 Carbon Cloth、泡沫鎳 Nickel Foam）、水熱或電沉積合成參數（溫度、時間、升降溫速率）及子節點（分切電極片與後續 CV/GCD/XRD/XAS/XPS 測試紀錄）。
  3. 支援 **NocoDB / Baserow 風格之無程式碼動態檢視切換**：同一資料表可即時切換為 Grid（表格檢視）、Kanban（實驗進度看板）、Gallery（SEM/光譜縮圖牆）與 Calendar（貴儀中心與 NSRRC 光束線預約行事曆）。
* **實作作法**：
  於 `src/labflow/server/models.py` 定義以下核心資料表結構（包含但不限於）：
  - `reagents`：`id`, `name`, `formula`, `cas_number`, `vendor`, `catalog_no`, `lot_no`, `purity`, `quantity_remaining`, `unit`, `storage_location`, `sds_document_hash`, `expiry_date`。
  - `samples`：`id`, `sample_code`, `project_id`, `parent_sample_ids` (JSONB Array), `reagent_recipe_json` (JSONB), `synthesis_protocol_json` (JSONB), `status` (`synthesized` / `characterizing` / `archived` / `disposed`), `created_at`。
  - `instrument_runs`：`id`, `sample_id`, `technique` (`CV`, `GCD`, `PEIS`, `XRD`, `XAS`, `XPS`, `NMR`, `SEM`, `TEM`, `AFM`, `TGA`, `BET`), `facility_beamline` (如 `NSRRC TPS 19A`, `TPS 44A1`, `TLS BL01C`, `TLS BL10`), `raw_file_hash`, `nexus_h5_path`, `extracted_metrics_json` (JSONB)。
* **驗收條件 (Acceptance Criteria)**：
  - **AC-LIMS-01**：建立 [2027年度國科會三年期專題研究計畫書](https://docs.google.com/document/d/1THpMtOJWWkMvhEBo3EKmmxOUwcodIsTYOxZrCSyXgxo/edit?usp=drivesdk&ouid=110756226322385231249) 中之「水熱合成 `MIL-100(Fe)` 負載碳布正極 $\to$ 組裝無氟無氯深共晶鋁碘電池 $\to$ 執行 GCD 充放電與原位 XAS 表徵」完整樣品譜系鏈，查詢任一子電極片之祖先溯源樹（Ancestry Query）必須在單次遞迴 CTE 查詢內完整回傳所有前驅物批號與合成條件。

---

### 5.5 領域五：LaTeX 雲端編譯與學術排版流水線 (LaTeX Typesetting & Cloud Compilation)
* **參考軟體對標**：[Overleaf Community Edition](https://github.com/overleaf/overleaf)、[VS Code + Git](https://code.visualstudio.com/)、[TeXstudio](https://www.texstudio.org/)。
* **詳細規則**：
  1. 嚴格執行 **第 1.4 節 Linux 雲端相對路徑字型鐵律**：所有生成之 `.tex` 原始碼必須包含 `\usepackage{../../_common/styles/research-setup}`、`\setmainfont[Path=../../_common/fonts/]{times.ttf}` 與 `\setCJKmainfont[Path=../../_common/fonts/, AutoFakeBold=true, AutoFakeSlant=true]{pmingliu.ttc}`。
  2. 支援 **數據驅動之動態表格與圖譜注入（Data-Driven LaTeX Injection）**：當試算表或電化學/XRD/XPS 分析結果更新時，系統自動重新生成三線表（`booktabs` `\toprule`、`\midrule`、`\bottomrule`）與高解析 PDF 向量圖，並觸發增量編譯。
* **實作作法**：
  於 `src/labflow/engines/document_latex_engine.py` 實作 `CloudLatexCompiler`：
  1. 內建 Preamble 合規性靜態檢查器（Linter）：若輸入之 `.tex` 缺少上述三行相對路徑字型與樣式宣告，自動在 `\documentclass` 後方補齊。
  2. 實作雙向 SyncTeX 解析器：解析 `.synctex.gz`，提供 `forward_sync(tex_file, line, col) -> (page, x, y)` 與 `inverse_sync(page, x, y) -> (tex_file, line, col)`。
* **驗收條件 (Acceptance Criteria)**：
  - **AC-TEX-01**：呼叫 `CloudLatexCompiler.generate_manuscript()` 產出包含中英文混排、物理公式與三線數據表之 `.tex` 檔案，靜態檢查必須確認 100% 包含相對路徑 `../../_common/fonts/times.ttf`、`../../_common/fonts/pmingliu.ttc` 與 `../../_common/styles/research-setup`。

---

### 5.6 領域六：化學結構繪圖與 3D 分子/晶體建模 (Chemical Drawing & 3D Modeling)
* **參考軟體對標**：[Ketcher](https://github.com/epam/ketcher)、[Avogadro](https://avogadro.cc/)、[ChemCanvas](https://www.google.com/search?q=https://github.com/auriium/chemcanvas)。
* **詳細規則**：
  1. 支援 2D 化學結構繪製與格式互轉：SMILES、InChI、InChIKey、MDL Molfile (`V2000`/`V3000`)、RXN 反應式與 ChemDraw CDXML。
  2. 內建 **化學計量學與配製計算機（Stoichiometry & Hydrothermal Recipe Calculator）**：輸入化學反應式、目標摩爾濃度（Molarity）或水熱反應釜體積（如 $50\text{ mL}$ / $100\text{ mL}$ PPL/Teflon 內襯）及摩爾比（如 $\text{Cr}:\text{Mn} = 1:9$ 或深共晶電解液摩爾比），自動計算各試劑所需精確稱量質量（考慮試劑純度與結晶水分子量）。
  3. 支援 3D 分子與晶體結構（`.cif`、`.xyz`、`.pdb`、`.poscar`）讀取、超晶胞擴展（Supercell $n_a \times n_b \times n_c$）、鍵長/鍵角/二面角量測，以及基於 Lennard-Jones + 庫侖力場之幾何結構能量最小化（Steepest Descent / Conjugate Gradient）。
* **實作作法**：
  於 `src/labflow/engines/chem_structure_engine.py` 實作化學式解析器（支援括號嵌套與結晶水標記，如 $\text{Fe(NO}_3\text{)}_3\cdot 9\text{H}_2\text{O}$、$\text{KMnO}_4$、$\text{Cr(NO}_3\text{)}_3\cdot 9\text{H}_2\text{O}$）、同位素豐度分佈計算器與 CIF 對稱操作（Symmetry Equivalent Positions）展開器。
* **驗收條件 (Acceptance Criteria)**：
  - **AC-CHEM-01**：輸入含結晶水之複雜化學式 `"Fe(NO3)3·9H2O"` 與 `"AlCl3"`，計算出之標準分子量分別為 $404.00\text{ g/mol}$ 與 $133.34\text{ g/mol}$（相對誤差 $< 10^{-4}$）；輸入目標濃度 $0.05\text{ M}$、體積 $80\text{ mL}$、純度 $98.5\%$，計算出之精確稱量克數誤差 $< 0.01\text{ mg}$。

---

### 5.7 領域七：文獻管理與雙向連結知識星圖 (Literature Management & Knowledge Star Map)
* **參考軟體對標**：[Zotero](https://www.zotero.org/) + 插件 + NAS、[Obsidian](https://obsidian.md/)、[eLabFTW](https://www.elabftw.net/)。
* **詳細規則**：
  1. 解決傳統實驗室筆記（Evernote / Keep / OneNote 列表式）與實驗數據脫節之痛點：將每一篇 Zotero 文獻（`BibItem`）、每一頁實驗筆記（`ExperimentNote`）、每一組樣品（`Sample`）與每一張分析圖譜（`SpectrumRun`）視為 **知識星圖（Star Map）** 中的一等公民節點（First-Class Nodes）。
  2. 支援 Obsidian 風格之雙向連結語法 `[[Note_Title]]`、`[[DOI:10.1103/PhysRevD...]]`、`[[Sample:LF-20261114-ALI2-001]]` 與區塊級引用 `[[Note_Title#^block_id]]`。
  3. 知識星圖之節點新增、刪除與連線必須直接透過 [crdt.rs](https://drive.google.com/file/d/13dJVbJRmQdVReXicassnn6Qo0wwfuMA2/view?usp=drivesdk) 之 `OpKind::InsertNode`、`OpKind::LinkNodes` 與 `OpKind::DeleteLink` 進行同步。
* **實作作法**：
  於 `src/labflow/engines/zotero_starmap_engine.py` 實作：
  1. `BibTexRisParser`：解析 Zotero 匯出之 `.bib` / `.ris` 與 BetterBibTeX Citekey，自動關聯 NAS WebDAV 上的 PDF 附件路徑。
  2. `FruchtermanReingoldStarMap`：計算節點間之斥力 $f_r(d) = k^2 / d$ 與引力 $f_a(d) = d^2 / k$、計算節點中心性（PageRank 與 Betweenness Centrality），並識別尚未連結任何實驗結論之「孤島實驗數據節點（Orphan Data Nodes）」。
* **驗收條件 (Acceptance Criteria)**：
  - **AC-STAR-01**：匯入 50 筆含 `[[WikiLink]]` 雙向引用之實驗筆記、Zotero 文獻與 XAS/CV 數據節點，星圖引擎必須準確建立雙向鄰接表（Backlinks 100% 雙向對稱），並在 $< 50\text{ ms}$ 內收斂計算出 2D/3D 座標與 PageRank 權重。

---

### 5.8 領域八：PDF 全功能閱讀、拆併與向量圖譜數值提取套件 (PDF Processing Suite)
* **參考軟體對標**：[Stirling-PDF](https://github.com/Stirling-Tools/Stirling-PDF)、[LibreOffice Draw](https://www.libreoffice.org/discover/draw/)、[Okular](https://okular.kde.org/)、[Inkscape](https://inkscape.org/)、[PDFsam Basic](https://pdfsam.org/)、KillerPDF、PdfCraft。
* **詳細規則**：
  1. 支援無損 PDF 頁面拆分（Split by page ranges / bookmarks）、合併（Merge）、旋轉、浮水印嵌入、元數據清洗與雙欄學術論文版面重排（Dual-Column Academic Layout Extraction）。
  2. 內建 **文獻向量圖譜數值反演提取器（Vector Curve Digitizer）**：當使用者載入他人發表之期刊 PDF 時，可直接解析 PDF 內部之向量路徑指令（Bezier / LineTo 座標）或透過像素色彩遮罩校準 $(X_{\min}, X_{\max}, Y_{\min}, Y_{\max})$ 座標軸（支援線性軸與 $\log_{10}$ 對數軸），將文獻圖譜還原為 `(x, y)` 浮點數陣列供本系統直接疊圖比較。
* **實作作法**：
  於 `src/labflow/engines/document_latex_engine.py` 整合 `pypdf`、`pdfplumber` 與 `pypdfium2` 實作 `PdfScientificToolkit`。
* **驗收條件 (Acceptance Criteria)**：
  - **AC-PDF-01**：對多頁學術 PDF 執行拆分、合併與雙欄文字提取，文字順序不得發生左右欄交錯混亂；對已知座標範圍之合成向量曲線執行數值反演校準，還原之 `(x, y)` 數據點相對誤差 $< 0.2\%$。

---

### 5.9 領域九：圖譜海報編輯與出版級科學視覺化工作室 (Spectrum & Poster Studio)
* **參考軟體對標**：[Fiji / ImageJ](https://fiji.sc/)、[Veusz](https://github.com/veusz/veusz)、[SciDAVis](https://scidavis.sourceforge.net/)、[Inkscape](https://inkscape.org/)、[GIMP](https://www.gimp.org/)、以及雲端硬碟 [圖片優化_V2.py](https://drive.google.com/file/d/1Xux59U58611YUKbbgUv2l85Ug35tWXhb/view?usp=drivesdk)。
* **詳細規則**：
  1. 支援期刊級多面板組合圖排版（Multi-Panel Figure Composer）：內建 *Nature* / *Science* / *Physical Review D* / *ACS* 單欄（$85\text{ mm}$）、1.5 欄（$120\text{ mm}$）與雙欄（$175\text{ mm}$）標準尺寸預設集，自動標註 `(a)`, `(b)`, `(c)`, `(d)` 子圖標籤，並強制輸出 $\ge 600\text{ DPI}$ 無損 LZW 壓縮 TIFF、向量 PDF 與 SVG。
  2. 完整移植並強化 [圖片優化_V2.py](https://drive.google.com/file/d/1Xux59U58611YUKbbgUv2l85Ug35tWXhb/view?usp=drivesdk) 之 **`SEM_STUDIO_SMART_V1` 智慧多頁 TIFF 引擎**：
     - **Page 0**：嵌入高對比自適應比例尺（Adaptive Scalebar，自動根據底圖局部亮度 $L = 0.299R + 0.587G + 0.114B$ 切換黑底白字或白底黑字）與裁切掉原廠底部資訊列（Info Bar）之出版級影像。
     - **Page 1**：100% 原始未裁切、未壓縮之底圖備份（Raw Backup Frame），並在 TIFF Tag `270` (`ImageDescription`) 寫入 `"SEM_STUDIO_SMART_V1|" + json.dumps(state)`，確保未來隨時可無損重新編輯標尺位置、長度與字型大小。
* **驗收條件 (Acceptance Criteria)**：
  - **AC-POSTER-01**：輸入一張含底部資訊列之 $1024 \times 832$ 模擬 SEM 影像，呼叫 `SemStandardizerStudio.export_smart_tiff()` 後，使用 `PIL.ImageSequence` 讀取輸出之 `.tif` 必須包含 2 個 Frame，且讀取 Frame 1 之 Tag `270` 必須以 `"SEM_STUDIO_SMART_V1|"` 開頭並可完整反序列化出原始 `nm_per_px` 與裁切參數。

---

### 5.10 領域十：語音與聲學訊號分析系統 (Speech, Acoustic & Ultrasonic Signal Analysis)
* **參考軟體對標**：[Praat](https://www.fon.hum.uva.nl/praat/)、[SIL Speech Analyzer](https://software.sil.org/speech-analyzer/)、[Sonic Visualiser](https://www.sonicvisualiser.org/)、Open Audio Analyzer、[Essentia](https://essentia.upf.edu/)、[openSMILE](https://audeering.github.io/opensmile/)、[SuperCollider](https://supercollider.github.io/)、[Pure Data (Pd)](https://puredata.info/)。
* **詳細規則**：
  1. 支援實驗室語音備忘錄與學術講座錄音（如使用 **OM SYSTEM LS-P5** TRESMIC II 三麥克風錄製之 96 kHz / 24-bit 線性 PCM `.wav` 檔案）以及超音波震盪/水熱合成空化聲學監測訊號（Ultrasonic Cavitation Acoustic Emission）。
  2. 必須實作 **Praat 等效聲學分析管線**：
     - 自相關函數法（Autocorrelation / Boersma 演算法）提取基頻軌跡 $F_0(t)$（Pitch Contour）。
     - 線性預測編碼（LPC, Linear Predictive Coding）多項式求根提取前四共振峰頻率 $F_1, F_2, F_3, F_4$ 與頻寬。
  3. 必須實作 **openSMILE (eGeMAPS) 與 Essentia 核心特徵提取**：
     - 週期微擾（Jitter local, $\%$）、振幅微擾（Shimmer local, $\%$）、諧波雜訊比（HNR, $\text{dB}$）、頻譜質心（Spectral Centroid）、頻譜滾降點（Spectral Rolloff 85%）、過零率（Zero-Crossing Rate）與 13 階梅爾頻率倒譜係數（MFCC 1–13）。
* **實作作法**：
  於 `src/labflow/engines/acoustic_speech_engine.py` 使用 `numpy.fft`、`scipy.signal` 與 Levinson-Durbin / 多項式求根實作 `AcousticSpeechEngine`。
* **驗收條件 (Acceptance Criteria)**：
  - **AC-AUDIO-01**：輸入由基頻 $f_0 = 220.0\text{ Hz}$ 與共振調製合成之標準測試音訊（取樣率 $16,000\text{ Hz}$），提取之 $F_0$ 與 $220.0\text{ Hz}$ 絕對誤差必須 $< 1.5\text{ Hz}$，且回傳完整 $F_1$–$F_4$、Jitter、Shimmer、HNR 與 13 維 MFCC 向量（不得包含 `NaN` 或 `Inf`）。

---

### 5.11 領域十一：本地端 AI 推論、RAG 與機器學習訓練流水線 (Local AI, RAG & ML Pipeline)
* **參考軟體對標**：[LocalAI](https://localai.io/)、[AnythingLLM](https://anythingllm.com/)、[ComfyUI](https://github.com/comfyanonymous/ComfyUI)、[Dify](https://dify.ai/)、[n8n](https://n8n.io/)、[Hugging Face Transformers](https://huggingface.co/docs/transformers/index)、[PyTorch](https://pytorch.org/)、[JAX](https://jax.readthedocs.io/)、[MLflow](https://mlflow.org/)、[Gradio](https://www.gradio.app/)、[Taipy](https://www.taipy.io/)。
* **詳細規則**：
  1. **本地端優先推論（Local-First Inference）**：內建 OpenAI 相容之本地 API 路由層，預設對接本地 **Ollama** 實例（支援模型如 `qwen2.5-abliterated:14b`、`hermes3:8b`、`dolphin-llama3:8b`）與 **LocalAI**，確保未發表之國科會計畫構想、理論物理模型與實驗原始數據 100% 留存於本地 NVIDIA GPU 伺服器。
  2. **AnythingLLM / Dify 風格之混合檢索增強生成（Hybrid Scientific RAG）**：結合稠密向量檢索（Dense Embedding Cosine Similarity）與稀疏關鍵字檢索（BM25，確保化學式如 `Cr-MnO2`、`MIL-100(Fe)` 與光束線編號 `TPS 19A` 精確命中），透過 Reciprocal Rank Fusion ($\text{RRF}(d) = \sum \frac{1}{60 + \text{rank}_i(d)}$) 重排序。
  3. **ComfyUI / n8n 節點式科學工作流引擎（Node-Graph Scientific Workflow DAG）**：允許將「載入 `.mpt` $\to$ 扣除基線 $\to$ 執行 Dunn 分析 $\to$ MLflow 記錄指標 $\to$ 更新 LaTeX 表格」串聯為可序列化之 JSON 節點圖。
* **驗收條件 (Acceptance Criteria)**：
  - **AC-AI-01**：在無外部網際網路連線環境下，透過 Hybrid RAG 檢索包含 `TPS 19A`、`Al-I2` 與 `Dunn's method` 之本地知識庫，RRF Top-1 檢索命中率必須達 100%；節點式工作流 DAG 執行完成後自動產生相容於 MLflow 之 `metrics.json` 與 `params.json` 追蹤紀錄。

---

### 5.12 領域十二：自主科學代理人與電腦操作執行環境 (Autonomous Scientific Agents & Sandboxed Execution)
* **參考軟體對標**：[Agent Zero](https://github.com/agent0ai/agent-zero)、[Agent S (Simular AI)](https://github.com/simular-ai/Agent-S)、[Cua (Computer-Use Agent)](https://github.com/trycua/cua)、[OpenHands](https://www.openhands.dev/)、[OpenManus](https://github.com/mannaandpoem/OpenManus)、[Open Interpreter](https://github.com/OpenInterpreter/open-interpreter)、以及雲端硬碟 [agent.py](https://drive.google.com/file/d/1O6KAham_7eI7EHiAh8I57QUuRntQQ1U-/view?usp=drivesdk) 與 [analysis.py](https://drive.google.com/file/d/1A6wCXCj44l-VxZeJlueChi-kICAU-x6V/view?usp=drivesdk)。
* **詳細規則**：
  1. 完整升級 `Antigraity` 代理人核心：任何複雜分析請求必須先透過 [analysis.py](https://drive.google.com/file/d/1A6wCXCj44l-VxZeJlueChi-kICAU-x6V/view?usp=drivesdk) 之 **Tree-of-Thoughts (`ToTNode`)** 分解為多分支假設樹（例如：同時評估 Shirley 基線 vs. Tougaard 基線、或評估 2 峰 vs. 3 峰 Voigt 擬合），依據物理合理性評分（Critic Score + AICc）剪枝（Pruning）並選出最優執行路徑。
  2. **自我修正閉環（Self-Healing Feedback Loop）**：當 `Critic.verify_physics` 退回不合理之擬合結果（如出現負值半高寬或 $R^2 < 0.85$）時，代理人不得直接向使用者報錯，必須自動調整初始猜測值（Initial Guesses）與邊界約束（Bounds），最多自動重試 3 次並記錄每次重試之殘差收斂軌跡。
  3. **Computer-Use 舊版科學軟體橋接器（Cua / Agent S Legacy GUI Bridge）**：針對僅提供 Windows GUI 執行檔之傳統專業軟體（如 MDI Jade 5、CasaXPS、XPSPeak 4.1、OriginPro 8.5），實作無頭 Xvfb / Wine 視窗截圖座標定位與巨集腳本自動派發橋接器。
* **驗收條件 (Acceptance Criteria)**：
  - **AC-AGENT-01**：向 `Antigraity` 注入一組帶有故意劣質初始猜測值（包含負 FWHM 提案）之雙峰光譜任務，`Critic` 必須在第 1 輪攔截負 FWHM 分支，`ToTNode` 自動切換至正定約束分支並在 $\le 3$ 輪內收斂至 $R^2 > 0.995$。

---

### 5.13 領域十三：私有雲、虛擬化與高可用儲存基礎設施 (Cloud, Virtualization & ZFS Storage Infrastructure)
* **參考軟體對標**：[Proxmox VE](https://www.proxmox.com/en/downloads)、[TrueNAS SCALE](https://www.truenas.com/docs/solutions/integrations/proxmoxplugin/)、[Nextcloud Hub](https://www.truenas.com/docs/core/solutions/integrations/nextcloud/)、[YunoHost](https://yunohost.org/)、[CasaOS](https://casaos.io/)。
* **詳細規則**：
  1. 儲存層採用 **TrueNAS SCALE ZFS** 檔案系統設計，強制劃分三個獨立 ZFS 資料集（Datasets）：
     - `tank/labflow/raw_immutable`：設定 `compression=zstd-6`、`readonly=on`（由匯入守護進程透過短暫快照視窗寫入原始儀器數據，防止人為覆寫原始數據）。
     - `tank/labflow/nexus_h5`：設定 `recordsize=1M`，專供高吞吐量 HDF5/NeXus 張量循序讀寫。
     - `tank/labflow/pgdata`：設定 `recordsize=16K`、`logbias=latency`，優化 PostgreSQL 交易效能。
  2. 計算層採用 **Proxmox VE** 虛擬化管理：將 L2 Go Host、L3 Python 科學引擎與 PostgreSQL 部署於輕量級 LXC 容器或 KVM 虛擬機，並配置 PCIe Passthrough 將 NVIDIA GPU 直通予本地 AI 推論與 Rust/CUDA 運算容器。
* **實作作法**：
  於 `deploy/docker-compose.production.yml` 與 `deploy/proxmox_zfs_provision.sh` 提供完整一鍵建置與健康檢查（Healthcheck）腳本，同時相容 CasaOS / YunoHost 輕量級單機邊緣部署。
* **驗收條件 (Acceptance Criteria)**：
  - **AC-CLOUD-01**：解析 `deploy/docker-compose.production.yml` 必須為合法 Compose v3.9+ 規格，涵蓋 `labflow-postgres`、`labflow-go-host`、`labflow-python-engines`、`labflow-local-ai` 與 `labflow-web-ui` 五大服務，且均具備明確之 `healthcheck`、Volume 持久化掛載與最小權限安全設定。

---

### 5.14 領域十四：特殊專業科學分析引擎全集 (Specialized Scientific Analysis Suite — 7 Sub-Domains)

本領域為 LabFlow 系統之核心科學護城河，代理人必須將使用者雲端硬碟內所有獨立腳本與國際標準分析軟體演算法完整融合為七大專業子引擎：

#### 14.A 電化學全面分析引擎 (Electrochemistry Suite)
* **對標與基底程式碼**：[electrochem_universal_suite_v6.py](https://drive.google.com/file/d/1qqh_0XHpVlAUu6w4KAYFh6RTNUcFJKof/view?usp=drivesdk)、[Ec_Lab_V5.py](https://drive.google.com/file/d/1tI8TjiznFbFITRsIQ_6nn-85VHPidCFv/view?usp=drivesdk)、[yadg EC-Lab Extractor](https://dgbowl.github.io/yadg/main/apidoc/yadg.extractors.eclab.html)、[rosetta-eclab](https://github.com/Nataniel0212/rosetta-eclab)。
* **詳細規則與數學公式**：
  1. **BioLogic EC-Lab v11.61 `.mpt` / `.mpr` 智慧解析**：自動讀取 `Nb header lines : N` 標頭，支援 `cp950` / `utf-8` / `latin1` 多編碼容錯，並透過欄位模糊匹配識別電位 `Ewe/V`、電流 `<I>/mA` 或 `I/mA`、時間 `time/s`、頻率 `freq/Hz`、實部阻抗 `Re(Z)/Ohm`、負虛部阻抗 `-Im(Z)/Ohm` 與圈數 `cycle number`。
  2. **循環伏安法 (CV) 動力學與電荷分離**：
     - **峰值電流冪律分析 (Power-Law $b$-value)**：$i_p = a \cdot v^b \implies \log_{10}|i_p| = \log_{10} a + b \log_{10} v$（$b \approx 0.5$ 為擴散控制，$b \approx 1.0$ 為表面電容控制）。
     - **Dunn 方法定量分離**：在固定電位 $V$ 下，對多掃速數據執行線性迴歸：
       $$\frac{i(V)}{v^{1/2}} = k_1(V) v^{1/2} + k_2(V)$$
       其中 $k_1(V) v$ 為表面電容貢獻電流，$k_2(V) v^{1/2}$ 為擴散控制貢獻電流。
     - **Trasatti 外表面與內孔隙電荷分離**：
       - 當 $v \to \infty$ 時，以 $q(v)$ 對 $v^{-1/2}$ 線性外推截距求得外表面電荷 $q_{\text{outer}}$。
       - 當 $v \to 0$ 時，以 $1/q(v)$ 對 $v^{1/2}$ 線性外推截距之倒數求得總電荷 $q_{\text{total}}$，內孔隙電荷 $q_{\text{inner}} = q_{\text{total}} - q_{\text{outer}}$。
  3. **恆電流充放電 (GCD) 非線性積分電容與 Ragone 評估**：
     - 針對電池型/擬電容非線性放電曲線（如 `Cr-MnO2@Ni foam` 或 `Al-I2` 電池），強制同時計算線性電容 $C_{\text{lin}} = \frac{I \Delta t}{m \Delta V}$ 與 **非線性能量守恆積分電容**：
       $$C_{\text{int}} = \frac{2 I \int_{t_{\text{start}}}^{t_{\text{end}}} \big(V(t) - V_{\min}\big)\,dt}{m (\Delta V)^2}$$
     - 庫侖效率 $\eta_C = \frac{\Delta t_{\text{discharge}}}{\Delta t_{\text{charge}}} \times 100\%$、能量密度 $E = \frac{I \int V(t)\,dt}{3.6 \cdot m}\ (\text{Wh/kg})$、功率密度 $P = \frac{3600 \cdot E}{\Delta t_{\text{discharge}}}\ (\text{W/kg})$。
  4. **電化學阻抗譜 (PEIS) 與 $iR$ 補償 Tafel 極化分析**：
     - **零交越插值法（Zero-Crossover Interpolation）**：在高頻區找尋 $-\text{Im}(Z)$ 由負轉正（電感轉電容）之相鄰兩點，以線性插值精確求得 $\text{Im}(Z) = 0$ 時之歐姆內阻 $R_s$，並由最高頻率點計算寄生電感 $L_{\text{stray}} = \frac{\text{Im}(Z_{\max})}{2\pi f_{\max}}$。
     - **Warburg 擴散係數 $\sigma_W$**：在低頻擴散尾段對 $\text{Re}(Z)$ 與 $\omega^{-1/2} = (2\pi f)^{-1/2}$ 執行線性迴歸求斜率 $\sigma_W$。
     - **特徵鬆弛時間常數 $\tau_0$**：由虛部電容 $C''(\omega) = \frac{-\text{Im}(Z)}{\omega |Z|^2}$ 峰值頻率 $f_0$ 計算 $\tau_0 = \frac{1}{2\pi f_0}$。
     - **LSV 自動 $iR$ 補償 Tafel 分析**：利用 PEIS 萃取之 $R_s$ 自動計算真實界面電位 $E_{iR\text{-free}} = E_{\text{applied}} - I \cdot R_s$，並在極化區對 $\eta$ 與 $\log_{10}|j|$ 擬合 Tafel 斜率 $b_{\text{Tafel}}\ (\text{mV/dec})$ 與交換電流密度 $j_0$。
  5. **電化學感測器與活化能模組**：計算檢出限 $\text{LOD} = \frac{3 \sigma_{\text{blank}}}{S}$、定量限 $\text{LOQ} = \frac{10 \sigma_{\text{blank}}}{S}$，以及變溫阿瑞尼士活化能 $\ln k = \ln A - \frac{E_a}{R T}$。
* **驗收條件 (Acceptance Criteria)**：
  - **AC-EC-01**：對照 `MnOFe5Co5_20261112_*` 實測基準數據集，演算法必須重現：10 mV/s 電容貢獻 `74.5%`、陰極峰 $b = 0.597$、Trasatti 外表面電荷 `60.0%`、GCD 積分電容 $C_{\text{int}} = 43.51, 25.05, 16.99\text{ F/g}$、PEIS 零交越 $R_s = 0.5192\ \Omega$、$L_{\text{stray}} = 0.223\ \mu\text{H}$、$\sigma_W = 7.985\ \Omega\cdot\text{s}^{-1/2}$、$\tau_0 = 10.01\text{ s}$ 及 $iR$ 補償 Tafel $R^2 > 0.999$。

#### 14.B X 光繞射與晶體結構精修引擎 (XRD & Crystallography)
* **對標與基底程式碼**：Jade、HighScore Plus、Match!、Search-Match、DIFFRAC.SUITE (EVA / TOPAS)、[FullProf](https://powder.ornl.gov/bragg_diffraction/data_analysis/software.html)、[GSAS-II](https://advancedphotonsource.github.io/GSAS-II-tutorials/)、CMPR、Spectra Studio、Origin、PowDLL、以及雲端硬碟 [gsas_ii_to_jade_5.py](https://drive.google.com/file/d/1sf3CWWZAVl9978dQ3LBw_BmN7e8_1gId/view?usp=drivesdk)。
* **詳細規則與數學公式**：
  1. **同步輻射至實驗室靶材波長精確轉換**：根據布拉格定律 $n\lambda = 2d\sin\theta$，將同步輻射高能光束線（如 $\lambda_1 = 0.77491\text{ \AA}$）之繞射角 $2\theta_1$ 嚴格轉換為實驗室 $\text{Cu K}\alpha$（$\lambda_2 = 1.5418\text{ \AA}$）之繞射角 $2\theta_2$：
     $$2\theta_2 = 2 \arcsin\left( \frac{\lambda_2}{\lambda_1} \sin\left(\frac{2\theta_1}{2}\right) \right)$$
  2. **三次樣條等步長重採樣（Cubic Spline Uniform Resampling）**：由於非線性反正弦轉換後之 $\Delta(2\theta_2)$ 步長呈現非均勻分佈，會導致 MDI Jade 5 或 Match! 尋峰演算法失準，必須使用 `scipy.interpolate.CubicSpline` 重新插值為嚴格等步長網格（預設 $\Delta(2\theta) = 0.02^\circ$），並對小於 $0$ 之插值下衝（Undershoot）截斷為 $0.0$。
  3. **二進位檔案防呆守衛（Binary Guard）**：讀取檔案前掃描前 $1,024\text{ bytes}$，若包含 `\x00` 空字元或亂碼比例 $> 30\%$（如誤選 `.gpx` 專案檔或二進位 `.raw`），立即攔截並提示正確匯出步驟。
  4. **Williamson-Hall 晶粒尺寸與微應變分離及 Rietveld 精修指標**：
     $$\beta_{hkl} \cos\theta_{hkl} = \frac{K \lambda}{D} + 4 \varepsilon \sin\theta_{hkl}$$
     並計算 Rietveld 加權圖譜殘差因子 $R_{wp} = \sqrt{\frac{\sum w_i (y_{i,\text{obs}} - y_{i,\text{calc}})^2}{\sum w_i y_{i,\text{obs}}^2}}$、圖譜因子 $R_p$ 與擬合優度 $\chi^2 = (R_{wp} / R_{exp})^2$。
* **驗收條件 (Acceptance Criteria)**：
  - **AC-XRD-01**：輸入 $\lambda_1 = 0.77491\text{ \AA}$ 下 $2\theta_1 \in [5^\circ, 90^\circ]$ 之合成數據，轉換至 $\lambda_2 = 1.5418\text{ \AA}$ 時，超過全反射臨界角（$\sin\theta_1 > 0.77491 / 1.5418 \implies 2\theta_1 > 60.35^\circ$）之數據點必須被安全過濾，且輸出之 `.xy` 檔案步長變異係數 $\text{CV}(\Delta 2\theta) < 10^{-12}$。

#### 14.C 同步輻射 X 光吸收光譜引擎 (Synchrotron XAS: XANES & EXAFS)
* **對標與基底程式碼**：[Demeter (Athena, Artemis, Hephaestus)](https://bruceravel.github.io/demeter/)、[Larch (`xraylarch`)](https://xraypy.github.io/xraylarch/)、WinXAS、Blueprint XAS、GNXAS、CTM4XAS、FDMNES、FEFF、以及雲端硬碟 [XAS.py](https://drive.google.com/file/d/1ce70_bpDL7K3hRxVjM8t5Akz6Df1uJ27/view?usp=drivesdk)。
* **詳細規則與數學公式**：
  1. **7 模型平行重網格化（7-Model Parallel Regridding）**：針對國家同步輻射研究中心（NSRRC `TPS 19A`、`TPS 44A1`、`TLS BL01C`、`TLS BL10`）Quick-XAS 連續掃描產生之非均勻時間—能量序列，平行執行 7 種插值與平滑迴歸模型：`Linear`、`PCHIP`（保單調分段三次 Hermite）、`Cubic Spline`、`Savitzky-Golay`、`Smoothing Spline`、`GPR (Matern)` 與 `Sinc (Bandlimited)`。
  2. **局部密度先驗結合 AIC 動態加權（Vectorized Local-Density AIC Weighting）**：
     - 計算局部採樣密度 $\rho(E_i) = \text{clip}\left(\frac{\text{median}(\Delta E)}{\Delta E_{\text{local}}(E_i)}, 0.1, 10.0\right)$。
     - 計算各模型之局部殘差赤池資訊量準則 $\text{AIC}_m(E_i) = n_{\text{win}} \ln(\text{RSS}_m / n_{\text{win}}) + 2 k_m$ 與相對權重 $W_{\text{AIC}, m}(E_i) = \frac{\exp(-\Delta\text{AIC}_m / 2)}{\sum_j \exp(-\Delta\text{AIC}_j / 2)}$。
     - 結合密度結構先驗 $S_{\text{prior}}(\rho)$ 合成最終混合權重：$W_{\text{final}} = \text{Normalize}\big(0.65 \cdot W_{\text{AIC}} + 0.35 \cdot S_{\text{prior}}(\rho)\big)$。
  3. **5 通道 NeXus/HDF5 特徵張量封裝（5-Channel `FeatureTensor`）**：將 `(Channel 0: AIC_Weighted_Main, Channel 1: PCHIP, Channel 2: GPR_Smooth, Channel 3: First_Derivative dμ/dE, Channel 4: Local_Noise_Variance)` 寫入 HDF5 `/entry/data/FeatureTensor`，並強制呼叫 `ds_x.make_scale('Energy_eV')` 與 `ds_tensor.dims[1].attach_scale(ds_x)` 完成原生維度軸綁定。
  4. **Larch / Athena 標準 XANES 歸一化與 EXAFS 轉換**：
     - 扣除邊前（Pre-edge）線性背景並除以邊後（Post-edge）Victoreen 多項式獲得歸一化吸收係數 $\mu_{\text{norm}}(E)$，以一階導數極大值定位吸收邊能量 $E_0$。
     - 轉換至光電子波向量空間：$k = \sqrt{\frac{2 m_e (E - E_0)}{\hbar^2}} \approx \sqrt{0.2624684 \cdot (E - E_0)}\ (\text{\AA}^{-1})$。
     - 對 $k^w \chi(k)$（支援 $w = 1, 2, 3$）施加 Hanning / Kaiser-Bessel 窗函數並執行快速傅立葉轉換（FFT），獲得徑向結構函數 $|\chi(R)|$ 與實部/虛部配位殼層資訊。
* **驗收條件 (Acceptance Criteria)**：
  - **AC-XAS-01**：輸入含高密度 XANES 區（步長 $0.2\text{ eV}$）與低密度 EXAFS 區（步長 $2.0\text{ eV}$）之光譜，系統必須在無 Python `for` 迴圈下透過 NumPy 廣播完成 7 模型 AIC 融合（每一能量點 $\sum_{m=1}^7 W_{\text{final}, m} = 1.0 \pm 10^{-9}$），並正確產出含 5 通道與 `X_Grid` Dimension Scale 之 `.nxs` / `.h5` 結構與 $|\chi(R)|$ 徑向分佈。

#### 14.D X 光光電子能譜引擎 (XPS Surface Chemistry)
* **對標與基底程式碼**：CasaXPS、XPSPeak 4.1、Thermo Avantage、[XPS拆分.py](https://drive.google.com/file/d/1umNO-SJjvVnXDXbPqMTl9U2GqEVP4Rk7/view?usp=drivesdk)、[baseline.py](https://drive.google.com/file/d/1SjsP0diWosSsim6inV7QuUXgk-kETgF4/view?usp=drivesdk) 與 [peak_fitting.py](https://drive.google.com/file/d/13lDHAms7lDR0JMUMcHcv9tC_BvfB5-oA/view?usp=drivesdk)。
* **詳細規則與數學公式**：
  1. **多能區自動拆分與荷電校正**：自動解析 ULVAC-PHI `.spe` 與 Thermo 多能區 `.csv`/`.txt`（如 `Survey`、`C 1s`、`O 1s`、`Mn 2p`、`Cr 2p`、`Fe 2p`、`I 3d`、`Al 2p`），並依據外來污染碳標準值 $\text{C 1s} = 284.80\text{ eV}$ 計算全域荷電位移 $\Delta E_{\text{charge}} = 284.80 - E_{\text{C1s, measured}}$，自動平移所有能區之束縛能（Binding Energy）。
  2. **迭代 Shirley 與 Tougaard 背景扣除**：
     - **Iterative Shirley Background**：
       $$B_{k+1}(E) = I_{\text{right}} + (I_{\text{left}} - I_{\text{right}}) \frac{\int_{E}^{E_{\text{left}}} \big(I(E') - B_k(E')\big)\,dE'}{\int_{E_{\text{right}}}^{E_{\text{left}}} \big(I(E') - B_k(E')\big)\,dE'}$$
       迭代至 $\max|B_{k+1} - B_k| < 10^{-6}$。
     - **Tougaard Universal Cross-Section Background**：
       $$B_{\text{Tougaard}}(E) = \int_{E}^{\infty} \frac{B_1 (E' - E)}{\big(C + (E' - E)^2\big)^2} I(E')\,dE'$$
       （預設通用參數 $B_1 = 2866\text{ eV}^2, C = 1643\text{ eV}^2$）。
  3. **自旋軌道耦合雙峰約束（Spin-Orbit Doublet Constraints）與 RSF 半定量**：
     - 強制支援 $p, d, f$ 軌域雙峰面積比鎖定（$p_{3/2}:p_{1/2} = 2:1$、$d_{5/2}:d_{3/2} = 3:2$、$f_{7/2}:f_{5/2} = 4:3$）與雙峰能量分裂間距 $\Delta E_{\text{SO}}$ 鎖定。
     - 根據 Scofield / Wagner 相對靈敏度因子（RSF, $S_i$）計算表面原子百分比：$\text{At}\%_i = \frac{A_i / S_i}{\sum_j (A_j / S_j)} \times 100\%$。
* **驗收條件 (Acceptance Criteria)**：
  - **AC-XPS-01**：輸入含階梯背景與雙自旋軌道耦合峰之合成 XPS 數據，Shirley 基線必須在 $\le 30$ 次迭代內收斂，且雙峰解捲積後之面積比嚴格維持 $2.000 \pm 0.005$（$2p$ 軌域），原子百分比總和嚴格等於 $100.0\%$。

#### 14.E 核磁共振光譜引擎 (NMR Spectroscopy)
* **對標軟體**：MestReNova (Mnova)、Bruker TopSpin、Wiley KnowItAll Analytical Edition、Chenomx NMR Suite、Delta NMR Software、ChemDraw (NMR 預測功能)。
* **詳細規則與數學公式**：
  1. **自由感應衰減訊號 (FID) 前處理与 FFT**：讀取複數時域訊號 $S(t) = S_{\text{real}}(t) + i S_{\text{imag}}(t)$，施加指數窗函數（Exponential Line Broadening $W(t) = \exp(-\pi \cdot \text{LB} \cdot t)$），執行零填充（Zero-Filling 至 $2^N$ 點）與複數快速傅立葉轉換（FFT）並轉換為化學位移軸 $\delta\ (\text{ppm}) = \frac{\nu - \nu_{\text{ref}}}{\nu_0} \times 10^6$。
  2. **零階與一階自動相位校正（Entropy Minimization Phase Correction）**：
     $$S_{\text{corr}}(\nu) = S(\nu) \exp\left(i \left(\phi_0 + \phi_1 \frac{\nu - \nu_{\text{pivot}}}{\Delta \nu}\right)\right)$$
     透過最小化實部光譜導數資訊熵 $H = -\sum h_i \ln h_i$ 加負峰懲罰項，自動求得最優相位角 $(\phi_0, \phi_1)$。
  3. **多重峰積分與耦合常數提取**：自動偵測 Singlet (`s`)、Doublet (`d`)、Triplet (`t`)、Quartet (`q`) 與 Multiplet (`m`)，計算相對質子積分面積比與裂分耦合常數 $J\ (\text{Hz})$。
* **驗收條件 (Acceptance Criteria)**：
  - **AC-NMR-01**：對帶有故意相位偏移 $\phi_0 = 35^\circ, \phi_1 = -15^\circ$ 之合成 1H NMR FID 執行自動相位校正與 FFT，校正後吸收譜負峰面積比例必須 $< 0.5\%$，且各峰群相對積分面積比與真實質子數（如 $3:2:1$）誤差 $< 1.0\%$。

#### 14.F 電子顯微鏡與掃描探針顯微鏡引擎 (EM & SPM: SEM / TEM / EDS / AFM / STM)
* **對標與基底程式碼**：Digital Micrograph (Gatan GMS)、AZtec (Oxford Instruments)、[ImageJ / FIJI](https://fiji.sc/)、Crystalindex、TEManalyze、NanoScope Analysis、[Gwyddion](http://gwyddion.net/)、Mountains (MountainsMap / MountainsSPIP)、XEI (Park Systems AFM)、以及 [圖片優化_V2.py](https://drive.google.com/file/d/1Xux59U58611YUKbbgUv2l85Ug35tWXhb/view?usp=drivesdk)。
* **詳細規則與數學公式**：
  1. **HRTEM / SAED 2D-FFT 倒易晶格與晶面間距自動標定 (`Crystalindex` / `TEManalyze`)**：
     - 對選取之高解析晶格條紋區（ROI）乘以 2D Hann 窗函數（消除邊界十字偽影），執行 `np.fft.fftshift(np.fft.fft2(roi))` 獲得功率譜 $P(u, v) = \ln(1 + |F(u,v)|)$。
     - 自動定位中心透射斑點 $(u_0, v_0)$ 與繞射斑點對 $(u_i, v_i)$，計算倒易空間向量長度 $g_i = \frac{\sqrt{(u_i - u_0)^2 + (v_i - v_0)^2}}{N \cdot \Delta x}$，進而求得實空間晶面間距 $d_{hkl} = 1 / g_i\ (\text{nm})$ 與晶面夾角 $\phi_{ij} = \arccos\left(\frac{\vec{g}_i \cdot \vec{g}_j}{|\vec{g}_i| |\vec{g}_j|}\right)$，並比對標準晶體庫標定 $(hkl)$ 與晶帶軸（Zone Axis $[uvw]$）。
  2. **AFM / STM 表面形貌整平與粗糙度統計 (`Gwyddion` / `NanoScope` / `XEI`)**：
     - 實作最小平方法二維平面傾角扣除（Plane Leveling：$z_{\text{corr}}(x,y) = z(x,y) - (a x + b y + c)$）與逐行中位數對齊（Line-by-Line Median Flattening，消除掃描熱漂移條紋）。
     - 嚴格遵循 ISO 25178 計算算術平均粗糙度 $R_a = \frac{1}{MN}\sum |z_{ij} - \bar{z}|$、均方根粗糙度 $R_q = \sqrt{\frac{1}{MN}\sum (z_{ij} - \bar{z})^2}$、最大峰谷高差 $R_{\max} = \max(z) - \min(z)$、偏態 $R_{sk}$、峰度 $R_{ku}$ 與高度分佈直方圖。
* **驗收條件 (Acceptance Criteria)**：
  - **AC-SPM-01**：輸入晶格常數已知為 $d = 0.245\text{ nm}$ 之合成正弦晶格 HRTEM 影像，2D-FFT 自動標定出之 $d_{hkl}$ 與真實值誤差必須 $< 0.003\text{ nm}$；對疊加傾角平面 $z_{\text{tilt}} = 0.5x - 0.3y$ 之合成 AFM 矩陣執行 Plane Leveling 後，殘餘傾角斜率必須 $< 10^{-10}$。

#### 14.G 熱分析、孔隙率、流變學與多變量結構方程模型引擎 (Thermal, Porosity, Rheology & Multivariate SEM/PLS)
* **對標軟體**：MolDraw TGA & DSC 檢視器、Micromeritics MicroActive、Anton Paar Kaomi、IBM SPSS Amos、SmartPLS、LISREL、[jamovi](https://www.jamovi.org/)、[JASP](https://jasp-stats.org/)、Mplus、R 語言（`lavaan` 套件）。
* **詳細規則與數學公式**：
  1. **熱重與差示掃描量熱分析 (TGA / DTG / DSC)**：
     - 計算質量百分比 $W(T)\% = \frac{m(T)}{m_0} \times 100\%$ 與一階微分熱重曲線 $\text{DTG}(T) = -\frac{dW}{dT}$，自動標定水分脫附、配體裂解與骨架坍塌階梯溫度及殘炭率。
     - 實作多升溫速率 $\beta_i$ 之 **Kissinger 熱裂解活化能方程式**：
       $$\ln\left(\frac{\beta_i}{T_{p, i}^2}\right) = \ln\left(\frac{A R}{E_a}\right) - \frac{E_a}{R T_{p, i}}$$
  2. **氣體吸附孔隙率分析 (Micromeritics MicroActive BET & BJH)**：
     - 在相對壓力區間 $0.05 \le P/P_0 \le 0.30$（並支援 Rouquerol 單調遞增判準過濾，確保 $C > 0$）執行 **BET 線性轉換**：
       $$\frac{1}{v \big((P_0 / P) - 1\big)} = \frac{1}{v_m C} + \frac{C - 1}{v_m C} \left(\frac{P}{P_0}\right)$$
       由斜率 $s$ 與截距 $i$ 求單層吸附容量 $v_m = \frac{1}{s + i}$、BET 常數 $C = 1 + \frac{s}{i}$ 與總比表面積 $S_{\text{BET}} = \frac{v_m N_A \sigma_{\text{N}_2}}{V_m}$（其中 $\sigma_{\text{N}_2} = 0.162\text{ nm}^2$）。
     - 實作 **BJH 介孔孔徑分佈**：結合 Kelvin 方程式 $r_k(P/P_0) = \frac{-2 \gamma V_L}{R T \ln(P/P_0)} \approx \frac{-0.953}{\ln(P/P_0)}\ (\text{nm})$ 與 Halsey 統計吸附層厚度 $t(P/P_0) = 0.354 \left[\frac{-5}{\ln(P/P_0)}\right]^{1/3}\ (\text{nm})$，計算真實孔半徑 $r_p = r_k + t$ 與微分孔體積分佈 $\frac{dV}{d\log D}$。
  3. **流變學擬合 (Anton Paar Kaomi)**：支援電極漿料（Slurry）之 Herschel-Bulkley 屈服應力模型 $\tau = \tau_0 + K \dot{\gamma}^n$ 與 Cross 剪切稀化黏度模型 $\eta(\dot{\gamma}) = \eta_\infty + \frac{\eta_0 - \eta_\infty}{1 + (\lambda \dot{\gamma})^m}$。
  4. **多變量偏最小平方法結構方程模型 (SmartPLS / Amos / lavaan PLS-SEM)**：
     - 實作 **NIPALS / Wold PLS-PM 迭代演算法**：同時估計外部測量模型（Outer Measurement Model 負載量 $\lambda_{jk}$）與內部結構模型（Inner Structural Model 路徑係數 $\beta_{ij}$ 與決定係數 $R^2$）。
     - 強制計算並檢驗信度與效度指標：Cronbach's $\alpha$、組合信度（Composite Reliability $\rho_c = \frac{(\sum \lambda_i)^2}{(\sum \lambda_i)^2 + \sum \text{Var}(e_i)}$，要求 $\ge 0.70$）、平均變異數萃取量（$\text{AVE} = \frac{\sum \lambda_i^2}{\sum \lambda_i^2 + \sum \text{Var}(e_i)}$，要求 $\ge 0.50$）以及區別效度 Fornell-Larcker 與 HTMT 矩陣。
* **驗收條件 (Acceptance Criteria)**：
  - **AC-THERM-01**：輸入已知 $v_m = 120.0\text{ cm}^3/\text{g STP}, C = 85.0$ 之合成 $\text{N}_2$ 等溫吸附線，BET 引擎計算出之 $S_{\text{BET}}$ 與理論值 $522.3\text{ m}^2/\text{g}$ 相對誤差必須 $< 0.1\%$ 且線性迴歸 $R^2 > 0.9999$；輸入 3 組潛在變數之結構方程數據，PLS-SEM 必須在 $\le 100$ 次迭代內收斂並輸出完整路徑係數 $\beta$、$R^2$、AVE 與 $\rho_c$。

---

## 6. 代理人分階段執行路線圖與全自動驗收總閘門 (Phased Execution Roadmap & Master Acceptance Gate)

代理人必須嚴格依照以下六個階段（Phase 0 至 Phase 5）依序執行，每一階段必須通過對應之 CLI 驗證指令（Exit Code 必須為 `0`），始得進入下一階段：

| 執行階段 | 階段名稱與核心交付目標 | 代理人具體操作步驟 | 階段驗收 CLI 指令與通過條件 (Gate Criteria) |
| :--- | :--- | :--- | :--- |
| **Phase 0** | **環境盤點與介面契約鎖定 (Contract Freeze)** | 1. 驗證工作區目錄結構與 `proto/labflow.proto`、`include/labflow_c_abi.h`<br>2. 生成 Go / Python / TypeScript 之 Protobuf 綁定碼 | `protoc --proto_path=proto --python_out=src/labflow/proto proto/labflow.proto` 零錯誤完成 |
| **Phase 1** | **L1 Rust 核心、C ABI 與 CRDT 狀態機建置** | 1. 編譯 `core-engine` (`lib.rs`, `c_abi.rs`, `crdt.rs`, `data_ingestion.rs`)<br>2. 驗證零拷貝指標邊界與 Lamport 9 種 `OpKind` 收斂性 | `cargo test --manifest-path core-engine/Cargo.toml` 通過率 100%，且 C ABI 越界存取回傳 `-2` |
| **Phase 2** | **L2 Go 主機服務、10% 閒置排程與雙寫儲存層** | 1. 實作 `host-service` gRPC / WebSocket Hub 與 10% Idle CPU 節流器<br>2. 對接 PostgreSQL JSONB 與 HDF5/NeXus 雙寫協調器 | `go test ./host-service/...` 通過率 100%，背景執行緒 CPU 節流器不超過設定上限 |
| **Phase 3** | **L3 Python 十四大領域科學計算引擎實作** | 1. 依第 5 節規範實作全部 14 大領域科學引擎模組<br>2. 驗證所有數學公式、物理邊界與檔案格式相容性 | 執行 `PYTHONPATH=.:src python3 -m unittest discover -s tests` 全部測試函數 100% 通過 |
| **Phase 4** | **Antigraity 自主代理人、ToT 思維樹與 Critic 守衛** | 1. 實作 `ToTNode` 分支展開、`Critic` 物理/記憶體檢核與 3 次自癒重試<br>2. 整合本地 Ollama RAG 與舊版科學軟體 Computer-Use 橋接 | 對非法參數（負 FWHM / 越界指標）攔截率 100%，對劣質初始值自癒收斂率 100% |
| **Phase 5** | **L4 Tauri/React/WebGL 工作台與全棧容器編排** | 1. 建置單一檔案與桌面工作台介面（含 60 FPS 二進位畫布與知識星圖）<br>2. 驗證 Linux LaTeX 相對路徑範本與 Proxmox/TrueNAS 部署配置 | `python3 skills/web-app-generation/scripts/check_web_app.py` 輸出 `OK: no issues found.` |

---

## 7. 參考軟體與雲端專案資產索引 (Reference Software & Workspace Asset Index)

1. **使用者雲端硬碟核心專案與範本**：
   - 專案根目錄：[實驗室資料處理與存處系統](https://drive.google.com/drive/folders/1LxGTN_FEV7LykOaJyRse6ZIOcjhtW-5j)
   - 核心架構專案：[LabFlow\_Pro](https://www.google.com/search?q=https://drive.google.com/drive/folders/1C2GVe2J0gO_St3ODERLF2vsX-H_kekX_)（含 [implementation_plan.md](https://drive.google.com/file/d/17Ikbi2sXDtfX45OU8wKa5GQwdk3A6N10/view?usp=drivesdk)、[README.md](https://drive.google.com/file/d/1DHZsY9qaOMaAMYHAp0DIitYX2Aqzzh-5/view?usp=drivesdk)、[pyproject.toml](https://drive.google.com/file/d/1qPmU1mbolCJlG0kr1y2GZT6oBFkyUAh5/view?usp=drivesdk)、[proto/labflow.proto](https://drive.google.com/file/d/1tXd3CspytMblXNBR39KyXYyoieEyOYCO/view?usp=drivesdk)、[lib.rs](https://drive.google.com/file/d/1wzRZqWLOm6CsbhISNTJdC5aTmue8Jnrr/view?usp=drivesdk)、[crdt.rs](https://drive.google.com/file/d/13dJVbJRmQdVReXicassnn6Qo0wwfuMA2/view?usp=drivesdk)、[data_ingestion.rs](https://drive.google.com/file/d/1pTaPlZE5N4p13_0MoH-isXzyNTfb2GUe/view?usp=drivesdk)、[App.tsx](https://drive.google.com/file/d/1l1V9gcqlg3zL0Zo3uaUS68x-Klvz3m_l/view?usp=drivesdk)、[agent.py](https://drive.google.com/file/d/1O6KAham_7eI7EHiAh8I57QUuRntQQ1U-/view?usp=drivesdk)、[analysis.py](https://drive.google.com/file/d/1A6wCXCj44l-VxZeJlueChi-kICAU-x6V/view?usp=drivesdk)、[models.py](https://drive.google.com/file/d/1QXyvD1J3enntErVG-yOLHKxXJRvB_ODo/view?usp=drivesdk)、[versioning_service.py](https://drive.google.com/file/d/1e-yIFQpney0wPfGuRSO97sF7fZ9w5o_S/view?usp=drivesdk)、[baseline.py](https://drive.google.com/file/d/1SjsP0diWosSsim6inV7QuUXgk-kETgF4/view?usp=drivesdk)、[peak_fitting.py](https://drive.google.com/file/d/13lDHAms7lDR0JMUMcHcv9tC_BvfB5-oA/view?usp=drivesdk)）
   - 科學分析獨立腳本與範本：[electrochem_universal_suite_v6.py](https://drive.google.com/file/d/1qqh_0XHpVlAUu6w4KAYFh6RTNUcFJKof/view?usp=drivesdk)、[Ec_Lab_V5.py](https://drive.google.com/file/d/1tI8TjiznFbFITRsIQ_6nn-85VHPidCFv/view?usp=drivesdk)、[XAS.py](https://drive.google.com/file/d/1ce70_bpDL7K3hRxVjM8t5Akz6Df1uJ27/view?usp=drivesdk)、[gsas_ii_to_jade_5.py](https://drive.google.com/file/d/1sf3CWWZAVl9978dQ3LBw_BmN7e8_1gId/view?usp=drivesdk)、[XPS拆分.py](https://drive.google.com/file/d/1umNO-SJjvVnXDXbPqMTl9U2GqEVP4Rk7/view?usp=drivesdk)、[圖片優化_V2.py](https://drive.google.com/file/d/1Xux59U58611YUKbbgUv2l85Ug35tWXhb/view?usp=drivesdk)、[OriginPro85](https://drive.google.com/drive/folders/1apmjQ4DCL6Yaw7U0hyhnN1aBNdxpB1cV)（含 [PPNormal.otp](https://drive.google.com/file/d/13dWEnjUtsGMgN74Z1tbsTMKummvUFdI5/view?usp=drivesdk)、[PPExp.otp](https://drive.google.com/file/d/1ZppmbYsqPfbTBIPrEjXfLcTMTitF9Z03/view?usp=drivesdk)、[ReportFit.otp](https://drive.google.com/file/d/1KXdBf6XJV329VXV0iabJKkmdn5p-9hhu/view?usp=drivesdk)、[ReportPartial.otp](https://drive.google.com/file/d/1MJ-eTOc4dmdr5X709Wonif3YYJG8E2f4/view?usp=drivesdk)、[RIBBON.otp](https://drive.google.com/file/d/1FFSV2X2HCtx8NOfhuDEj6WQrKMYPmc6B/view?usp=drivesdk)）、[轉檔程式設計](https://www.google.com/search?q=https://drive.google.com/drive/folders/1Mhkn8ezpO8iPNXK7dIYRV4TpOnaydYK1)、[2027年度國科會三年期專題研究計畫書：無氟無氯深共晶—鋁碘電池系統之開發與跨界面協同機制研究（學者完善修訂版）](https://docs.google.com/document/d/1THpMtOJWWkMvhEBo3EKmmxOUwcodIsTYOxZrCSyXgxo/edit?usp=drivesdk&ouid=110756226322385231249)
2. **開源與專業科學參考專案**：
   - 表格、文件、資料庫與知識管理：[Grist (`grist-core`)](https://github.com/gristlabs/grist-core)、[eLabFTW](https://www.elabftw.net/)、[NocoDB](https://github.com/nocodb/nocodb)、[Baserow](https://baserow.io/)、[SENAITE](https://www.senaite.com/)、[openBIS](https://openbis.ch/)、[Paperless-ngx](https://github.com/paperless-ngx/paperless-ngx/discussions/13645)、[Stirling-PDF](https://github.com/Stirling-Tools/Stirling-PDF)、[Ketcher](https://github.com/epam/ketcher)、[Avogadro](https://avogadro.cc/)、[Zotero](https://www.zotero.org/)、[Obsidian](https://obsidian.md/)
   - 圖譜、聲學、專業分析與代理人基礎設施：[Veusz](https://github.com/veusz/veusz)、[Fiji / ImageJ](https://fiji.sc/)、[openSMILE](https://audeering.github.io/opensmile/)、[Praat](https://www.fon.hum.uva.nl/praat/)、[Essentia](https://essentia.upf.edu/)、[GSAS-II](https://advancedphotonsource.github.io/GSAS-II-tutorials/)、[FullProf](https://powder.ornl.gov/bragg_diffraction/data_analysis/software.html)、[Demeter (Athena/Artemis/Hephaestus)](https://bruceravel.github.io/demeter/)、[Larch (`xraylarch`)](https://xraypy.github.io/xraylarch/)、[Gwyddion](http://gwyddion.net/)、[yadg EC-Lab Extractor](https://dgbowl.github.io/yadg/main/apidoc/yadg.extractors.eclab.html)、[rosetta-eclab](https://github.com/Nataniel0212/rosetta-eclab)、[OpenHands](https://www.openhands.dev/)、[Agent Zero](https://github.com/agent0ai/agent-zero)、[Agent S](https://github.com/simular-ai/Agent-S)、[Cua](https://github.com/trycua/cua)、[Proxmox VE](https://www.proxmox.com/en/downloads)、[TrueNAS SCALE](https://www.truenas.com/docs/solutions/integrations/proxmoxplugin/)、[Nextcloud](https://www.truenas.com/docs/core/solutions/integrations/nextcloud/)
