using UnrealBuildTool;

public class FishingSim : ModuleRules
{
	public FishingSim(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

		// Позволяет писать #include "Fishing/FishingComponent.h" и т.п. из любой папки модуля
		PublicIncludePaths.Add(ModuleDirectory);

		PublicDependencyModuleNames.AddRange(new string[]
		{
			"Core",
			"CoreUObject",
			"Engine",
			"InputCore",
			"EnhancedInput",
			"DeveloperSettings",
			"HTTP",
			"Json",
			"JsonUtilities"
		});
	}
}
