using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.UIElements;

namespace NeuralCars.Editor
{
    public static class LabProjectSetup
    {
        public const string ScenePath = "Assets/NeuralCars/Scenes/NeuralCars.unity";
        private const string PanelPath = "Assets/NeuralCars/Resources/LabPanel.asset";

        [InitializeOnLoadMethod]
        private static void OnLoaded()
        {
            EditorApplication.delayCall += CreateIfMissing;
        }

        private static void CreateIfMissing()
        {
            if (!File.Exists(ScenePath) && !EditorApplication.isPlayingOrWillChangePlaymode) CreateScene();
        }

        [MenuItem("Neural Cars/Open laboratory")]
        public static void OpenLab()
        {
            if (!File.Exists(ScenePath)) CreateScene();
            else EditorSceneManager.OpenScene(ScenePath);
        }

        [MenuItem("Neural Cars/Recreate laboratory scene")]
        public static void CreateScene()
        {
            Directory.CreateDirectory("Assets/NeuralCars/Scenes");
            var panel = AssetDatabase.LoadAssetAtPath<PanelSettings>(PanelPath);
            if (panel == null)
            {
                panel = ScriptableObject.CreateInstance<PanelSettings>();
                panel.scaleMode = PanelScaleMode.ScaleWithScreenSize;
                panel.referenceResolution = new Vector2Int(1600, 1000);
                panel.screenMatchMode = PanelScreenMatchMode.MatchWidthOrHeight;
                panel.match = 0.5f;
                panel.themeStyleSheet = AssetDatabase.LoadAssetAtPath<ThemeStyleSheet>("Assets/NeuralCars/Resources/LabTheme.tss");
                AssetDatabase.CreateAsset(panel, PanelPath);
            }
            EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            var camera = new GameObject("Background camera").AddComponent<Camera>();
            camera.clearFlags = CameraClearFlags.SolidColor; camera.backgroundColor = new Color(0.05f, 0.08f, 0.12f);
            camera.orthographic = true; camera.tag = "MainCamera";
            var root = new GameObject("Neural Cars Laboratory");
            var document = root.AddComponent<UIDocument>();
            root.AddComponent<LabController>();
            document.panelSettings = panel;
            EditorUtility.SetDirty(document);
            EditorSceneManager.SaveScene(EditorSceneManager.GetActiveScene(), ScenePath);
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
            PlayerSettings.companyName = "Neural Labs"; PlayerSettings.productName = "Neural Cars";
            PlayerSettings.defaultScreenWidth = 1600; PlayerSettings.defaultScreenHeight = 1000;
            PlayerSettings.fullScreenMode = FullScreenMode.Windowed;
            PlayerSettings.resizableWindow = true; PlayerSettings.runInBackground = true;
            AssetDatabase.SaveAssets();
        }

        [MenuItem("Neural Cars/Build Windows")]
        public static void BuildWindows()
        {
            Directory.CreateDirectory("Builds/Windows");
            var result = BuildPipeline.BuildPlayer(new[] { ScenePath }, "Builds/Windows/NeuralCars.exe", BuildTarget.StandaloneWindows64, BuildOptions.None);
            if (result.summary.result != UnityEditor.Build.Reporting.BuildResult.Succeeded)
                throw new System.InvalidOperationException("Windows build failed: " + result.summary.result);
        }
    }
}
