using System;
using System.IO;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEngine;
using UnityEngine.Rendering;

namespace NeuralCars.Editor
{
    public static class AndroidBuild
    {
        public const string PackageName = "com.jacksparrot.neuralcars";
        public const string Version = "1.0.0";
        public const int VersionCode = 1;

        [MenuItem("Neural Cars/Build Android APK")]
        public static void Build()
        {
            if (EditorUserBuildSettings.activeBuildTarget != BuildTarget.Android)
                EditorUserBuildSettings.SwitchActiveBuildTarget(BuildTargetGroup.Android, BuildTarget.Android);
            PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Android, PackageName);
            PlayerSettings.bundleVersion = Version;
            PlayerSettings.Android.bundleVersionCode = VersionCode;
            PlayerSettings.SetScriptingBackend(NamedBuildTarget.Android, ScriptingImplementation.IL2CPP);
            PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64 | AndroidArchitecture.ARMv7;
            PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel26;
            PlayerSettings.Android.targetSdkVersion = AndroidSdkVersions.AndroidApiLevelAuto;
            PlayerSettings.Android.useCustomKeystore = false;
            PlayerSettings.Android.splitApplicationBinary = false;
            PlayerSettings.Android.buildApkPerCpuArchitecture = false;
            PlayerSettings.defaultInterfaceOrientation = UIOrientation.AutoRotation;
            PlayerSettings.allowedAutorotateToPortrait = false;
            PlayerSettings.allowedAutorotateToPortraitUpsideDown = false;
            PlayerSettings.allowedAutorotateToLandscapeLeft = true;
            PlayerSettings.allowedAutorotateToLandscapeRight = true;
            PlayerSettings.SetUseDefaultGraphicsAPIs(BuildTarget.Android, false);
            PlayerSettings.SetGraphicsAPIs(BuildTarget.Android, new[] { GraphicsDeviceType.OpenGLES3 });
            EditorUserBuildSettings.buildAppBundle = false;
            EditorUserBuildSettings.exportAsGoogleAndroidProject = false;
            EditorUserBuildSettings.androidBuildSystem = AndroidBuildSystem.Gradle;
            PlayerSettings.SetIcons(NamedBuildTarget.Android, new[] { AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/NeuralCars/AppIcon.png") }, IconKind.Any);
            var renderer = AssetDatabase.LoadAssetAtPath<UnityEngine.Object>("Assets/Settings/Renderer2D.asset");
            var rendererSettings = new SerializedObject(renderer);
            rendererSettings.FindProperty("m_PostProcessData").objectReferenceValue = null;
            rendererSettings.ApplyModifiedPropertiesWithoutUndo();
            AssetDatabase.SaveAssets();
            Directory.CreateDirectory("Builds/Android");
            string path = $"Builds/Android/neural-cars-{Version}-{VersionCode}.apk";
            BuildReport report = BuildPipeline.BuildPlayer(new[] { LabProjectSetup.ScenePath }, path, BuildTarget.Android, BuildOptions.None);
            File.WriteAllText("Builds/Android/build-report.json", JsonUtility.ToJson(new Receipt {
                packageName = PackageName, version = Version, versionCode = VersionCode,
                result = report.summary.result.ToString(), bytes = report.summary.totalSize,
                errors = (int)report.summary.totalErrors, warnings = (int)report.summary.totalWarnings
            }, true));
            if (report.summary.result != BuildResult.Succeeded) throw new InvalidOperationException("Android build failed.");
        }

        [Serializable] private sealed class Receipt
        {
            public string packageName, version, result;
            public int versionCode, errors, warnings;
            public ulong bytes;
        }
    }
}
